package org.entcore.test;

import com.mongodb.QueryBuilder;
import io.vertx.ext.mongo.MongoClient;
import org.entcore.common.elasticsearch.ElasticClientManager;
import org.entcore.common.postgres.PostgresClient;
import org.entcore.common.redis.RedisClient;
import org.testcontainers.containers.wait.strategy.HttpWaitStrategy;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.entcore.common.mongodb.MongoDbResult;
import org.entcore.common.neo4j.Neo4j;
import org.entcore.common.neo4j.Neo4jResult;
import org.entcore.common.sql.DB;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.containers.Neo4jContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import org.vertx.mods.MongoPersistor;

import fr.wseduc.mongodb.MongoDb;
import fr.wseduc.mongodb.MongoQueryBuilder;
import io.vertx.core.DeploymentOptions;
import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.unit.Async;
import io.vertx.ext.unit.TestContext;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Collections;
import java.util.Map;

public class DatabaseTestHelper {

    private class PostgreSQLContainerWithParams extends PostgreSQLContainer {

        public PostgreSQLContainerWithParams(String dockerImageName) {
            this(dockerImageName, null);
        }

        public PostgreSQLContainerWithParams(String dockerImageName, Map<String,String> params) {
            super(DockerImageName.parse(dockerImageName));
            if (params != null) {
                this.urlParameters.putAll(params);
            }
        }

    }

    private final Vertx vertx;

    public DatabaseTestHelper(Vertx v) {
        this.vertx = v;
    }

    public ElasticClientManager createESClient(final ElasticsearchContainer esContainer) throws URISyntaxException {
        final URI[] uris = new URI[]{new URI("http://" + esContainer.getHttpHostAddress())};
        return new ElasticClientManager(vertx, uris);
    }

    public RedisClient createRedisClient(final GenericContainer<?> redisContainer){
        final JsonObject redisConfig = new JsonObject().put("host", redisContainer.getHost()).put("port", redisContainer.getMappedPort(6379));
        final RedisClient redisClient = new RedisClient(vertx, redisConfig);
        return redisClient;
    }

    public PostgresClient createPgClient(final PostgreSQLContainer<?> pgContainer){
        final JsonObject postgresqlConfig = new JsonObject().put("host", pgContainer.getHost()).put("database", pgContainer.getDatabaseName()).put("user", pgContainer.getUsername()).put("password", pgContainer.getPassword()).put("port", pgContainer.getMappedPort(5432));
        final PostgresClient postgresClient = new PostgresClient(vertx, postgresqlConfig);
        return postgresClient;
    }

    public MongoClient createMongoClient(final MongoDBContainer mongoDBContainer){
        final JsonObject mongoConfig = new JsonObject().put("connection_string", mongoDBContainer.getReplicaSetUrl());
        return MongoClient.createShared(vertx, mongoConfig);
    }

    public Async initPostgreSQL(TestContext context, PostgreSQLContainer<?> postgreSQLContainer, String schema) {
        return initPostgreSQL(context, postgreSQLContainer, schema, true);
    }

    public Async initPostgreSQL(TestContext context, PostgreSQLContainer<?> postgreSQLContainer, String schema,
                                boolean loadScripts) {
        return initPostgreSQL(context, postgreSQLContainer, schema, loadScripts, 2000L);
    }

    public Async initPostgreSQL(TestContext context, PostgreSQLContainer<?> postgreSQLContainer, String schema,
                                boolean loadScripts, long delay) {
        final Async async = context.async();
        final JsonObject postgresConfig = new JsonObject().put("address", "sql.persistor")
                .put("url", postgreSQLContainer.getJdbcUrl()).put("username", postgreSQLContainer.getUsername())
                .put("password", postgreSQLContainer.getPassword());

        final DeploymentOptions deploymentOptions = new DeploymentOptions().setConfig(postgresConfig).setWorker(true)
                .setInstances(1).setMultiThreaded(true);

        vertx.deployVerticle(fr.wseduc.sql.SqlPersistor.class.getName(), deploymentOptions, ar -> {
            if (ar.succeeded()) {
                Sql sql = Sql.getInstance();
                sql.init(vertx.eventBus(), "sql.persistor");
                if (loadScripts) {
                    DB.loadScripts(schema, vertx, "sql");
                }
                vertx.setTimer(delay, t -> async.complete());
            } else {
                context.fail();
            }
        });
        return async;
    }

    public DatabaseClusterTestHelper cluster(){
        return new DatabaseClusterTestHelper(vertx);
    }

    public Async initMongo(TestContext context, MongoDBContainer mongoDBContainer) {
        final Async async = context.async();
        final JsonObject postgresConfig = new JsonObject().put("address", "wse.mongodb.persistor")
                .put("db_name", "test").put("host", mongoDBContainer.getContainerIpAddress())
                .put("use_mongo_types", true).put("pool_size", 10).put("port", mongoDBContainer.getMappedPort(27017));

        final DeploymentOptions deploymentOptions = new DeploymentOptions().setConfig(postgresConfig).setWorker(true)
                .setInstances(1).setMultiThreaded(true);

        vertx.deployVerticle(MongoPersistor.class.getName(), deploymentOptions, ar -> {
            if (ar.succeeded()) {
                MongoDb mongo = MongoDb.getInstance();
                mongo.init(vertx.eventBus(), "wse.mongodb.persistor");
                async.complete();
            } else {
                context.fail();
            }
        });
        return async;
    }

    public void initNeo4j(TestContext context, Neo4jContainer<?> neo4jContainer) {
        final String base = neo4jContainer.getHttpUrl() + "/db/data/";
        final JsonObject config = new JsonObject().put("server-uri", base).put("poolSize", 1);
        final Neo4j neo4j = Neo4j.getInstance();
        neo4j.init(vertx, config);
        vertx.sharedData().getLocalMap("server").put("neo4jConfig", config.encode());

    }

    public PostgreSQLContainer<?> createPostgreSQLContainer() {
        return new PostgreSQLContainerWithParams("postgres:9.5", Collections.singletonMap("stringtype", "unspecified"));
    }

    public PostgreSQLContainer<?> createPostgreSQL96Container() {
        return new PostgreSQLContainerWithParams("postgres:9.6", Collections.singletonMap("stringtype", "unspecified"));
    }

    public Neo4jContainer<?> createNeo4jContainer() {
        return new Neo4jContainer("neo4j:3.1").withoutAuthentication()//
                .withNeo4jConfig("cypher.default_language_version", "2.3");
    }

    public MongoDBContainer createMongoContainer() {
        return new MongoDBContainer("mongo:3.6.17");
    }

    public ElasticsearchContainer createElasticContainer() {
        return new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch-oss:7.9.3");
    }

    public ElasticsearchContainer createOpenSearchContainer() {
        final DockerImageName myImage = DockerImageName.parse("opensearchproject/opensearch:1.1.0").asCompatibleSubstituteFor("docker.elastic.co/elasticsearch/elasticsearch:latest");
        final ElasticsearchContainer opensearchContainer = new ElasticsearchContainer(myImage);
        opensearchContainer.withEnv("discovery.type", "single-node");
        opensearchContainer.withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true");
        opensearchContainer.withEnv("DISABLE_SECURITY_PLUGIN", "true");
        return opensearchContainer;
    }

    public GenericContainer createRedisContainer() {
        return new GenericContainer("redis:5.0.3-alpine");
    }

    public Future<JsonObject> executeSqlWithUniqueResult(String query, JsonArray values) {
        Sql sql = Sql.getInstance();
        Future<JsonObject> future = Future.future();
        sql.prepared(query, values, SqlResult.validUniqueResultHandler(res -> {
            if (res.isRight()) {
                future.complete(res.right().getValue());
            } else {
                future.fail(res.left().getValue());
            }
        }));
        return future;

    }

    public PostgresReactiveTestHelper pgReactive(PostgreSQLContainer<?> postgres){
        return new PostgresReactiveTestHelper(vertx, postgres);
    }

    public Future<JsonObject> executeMongoWithUniqueResultById(String collection, String id) {
        QueryBuilder builder = QueryBuilder.start("_id").is(id);
        final MongoDb mongo = MongoDb.getInstance();
        final Future<JsonObject> future = Future.future();
        mongo.findOne(collection, MongoQueryBuilder.build(builder), MongoDbResult.validResultHandler(res -> {
            if (res.isRight()) {
                future.complete(res.right().getValue());
            } else {
                future.fail(res.left().getValue());
            }
        }));
        return future;
    }

    public Future<JsonObject> executeMongoWithUniqueResult(String collection, JsonObject query) {
        final MongoDb mongo = MongoDb.getInstance();
        final Future<JsonObject> future = Future.future();
        mongo.findOne(collection, query, MongoDbResult.validResultHandler(res -> {
            if (res.isRight()) {
                future.complete(res.right().getValue());
            } else {
                future.fail(res.left().getValue());
            }
        }));
        return future;
    }

    public Future<JsonObject> executeNeo4jWithUniqueResult(String query, JsonObject params) {
        final Neo4j neo4j = Neo4j.getInstance();
        final Future<JsonObject> future = Future.future();
        neo4j.execute(query, params, Neo4jResult.validUniqueResultHandler(res -> {
            if (res.isRight()) {
                future.complete(res.right().getValue());
            } else {
                future.fail(res.left().getValue());
            }
        }));
        return future;
    }

    public Future<JsonArray> executeNeo4j(String query, JsonObject params) {
        final Neo4j neo4j = Neo4j.getInstance();
        final Future<JsonArray> future = Future.future();
        neo4j.execute(query, params, Neo4jResult.validResultHandler(res -> {
            if (res.isRight()) {
                future.complete(res.right().getValue());
            } else {
                future.fail(res.left().getValue());
            }
        }));
        return future;
    }
}