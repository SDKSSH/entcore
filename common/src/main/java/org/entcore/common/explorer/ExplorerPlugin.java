package org.entcore.common.explorer;

import io.vertx.core.CompositeFuture;
import io.vertx.core.Future;
import io.vertx.core.eventbus.DeliveryOptions;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.user.UserInfos;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

public abstract class ExplorerPlugin implements IExplorerPlugin {
    protected final Logger log = LoggerFactory.getLogger(getClass());

    protected final IExplorerPluginCommunication communication;
    protected Function<Void, Void> listener;

    protected ExplorerPlugin(final IExplorerPluginCommunication communication) {
        this.communication = communication;
    }

    @Override
    public void start() {
        final String id = IExplorerPlugin.addressFor(getApplication(), getResourceType());
        this.listener = communication.listen(id, message -> {
            onExplorerQuery(message);
        });
    }

    protected void onExplorerQuery(final Message<JsonObject> message) {
        final String actionStr = message.headers().get("action");
        final String userId = message.headers().get("userId");
        final String userName = message.headers().get("userName");
        final ExplorerRemoteAction action = ExplorerRemoteAction.valueOf(actionStr);
        switch (action) {
            case QueryCreate: {
                final JsonArray values = message.body().getJsonArray("resources", new JsonArray());
                final boolean copy = message.body().getBoolean("copy", false);
                final UserInfos user = new UserInfos();
                user.setUserId(userId);
                user.setUsername(userName);
                final List<JsonObject> jsons = values.stream().filter(e -> e instanceof JsonObject).map(e -> (JsonObject) e).collect(Collectors.toList());
                doCreate(user, jsons, copy).onComplete(idsRes -> {
                    if (idsRes.succeeded()) {
                        final List<String> ids = idsRes.result();
                        final List<JsonObject> safeSources = new ArrayList<>();
                        final List<String> safeIds = new ArrayList<>();
                        for (int i = 0; i < jsons.size() && i < ids.size(); i++) {
                            safeSources.add(jsons.get(i));
                            safeIds.add(ids.get(i));
                        }
                        toMessage(safeSources, source -> {
                            final int index = safeSources.indexOf(source);
                            final String id = safeIds.get(index);
                            final ExplorerMessage mess = ExplorerMessage.upsert(id, user, isForSearch()).withType(getApplication(), getResourceType());
                            return mess;
                        }).compose(messages -> {
                            return communication.pushMessage(messages);
                        }).onComplete(resPush -> {
                            if (resPush.succeeded()) {
                                message.reply(new JsonArray(ids));
                            } else {
                                message.reply(new JsonArray(ids), new DeliveryOptions().addHeader("error", ExplorerRemoteError.CreatePushFailed.getError()));
                                log.error("Failed to push created resource coming from explorer: ", idsRes.cause());
                            }
                        });
                    } else {
                        message.fail(500, ExplorerRemoteError.CreateFailed.getError());
                        log.error("Failed to create resource coming from explorer: ", idsRes.cause());
                    }
                });
                break;
            }
            case QueryDelete: {
                final JsonArray values = message.body().getJsonArray("ids", new JsonArray());
                final UserInfos user = new UserInfos();
                user.setUserId(userId);
                user.setUsername(userName);
                final List<String> ids = values.stream().filter(e -> e instanceof String).map(e -> (String) e).collect(Collectors.toList());
                doDelete(user, ids).onComplete(idsRes -> {
                    if (idsRes.succeeded()) {
                        final List<Boolean> deleteStatus = idsRes.result();
                        final List<ExplorerMessage> messages = new ArrayList<>();
                        final List<String> ok = new ArrayList<>();
                        final List<String> nok = new ArrayList<>();
                        for (int i = 0; i < deleteStatus.size() && i < ids.size(); i++) {
                            if (deleteStatus.get(i)) {
                                final ExplorerMessage mess = ExplorerMessage.delete(ids.get(i), user,isForSearch()).withType(getApplication(), getResourceType());
                                messages.add(mess);
                                ok.add(ids.get(i));
                            } else {
                                nok.add(ids.get(i));
                            }
                        }
                        communication.pushMessage(messages).onComplete(resPush -> {
                            final JsonObject payload = new JsonObject().put("deleted", new JsonArray(ok)).put("failed", new JsonArray(nok));
                            if (resPush.succeeded()) {
                                message.reply(payload);
                            } else {
                                message.reply(payload, new DeliveryOptions().addHeader("error", ExplorerRemoteError.DeletePushFailed.getError()));
                                log.error("Failed to push deleted resource coming from explorer: ", idsRes.cause());
                            }
                        });
                    } else {
                        message.fail(500, ExplorerRemoteError.DeleteFailed.getError());
                        log.error("Failed to delete resource coming from explorer: ", idsRes.cause());
                    }
                });
                break;
            }
            case QueryReindex: {
                final Optional<Long> from = Optional.ofNullable(message.body().getLong("from"));
                final Optional<Long> to = Optional.ofNullable(message.body().getLong("to"));
                final ExplorerStream<JsonObject> stream = new ExplorerStream<>(bulk -> {
                    return toMessage(bulk, e -> {
                        final String id = getIdForModel(e);
                        final UserInfos user = getCreatorForModel(e);
                        final ExplorerMessage mess = ExplorerMessage.upsert(id, user, isForSearch()).withType(getApplication(), getResourceType());
                        return mess;
                    }).compose(messages -> {
                        return communication.pushMessage(messages);
                    });
                }, metricsEnd -> {
                    message.reply(metricsEnd);
                });
                doFetchForIndex(stream, from.map(e -> new Date(e)), to.map(e -> new Date(e)));
                break;
            }
            case QueryMetrics: {
                //TODO
                message.reply(new JsonObject());
                break;
            }
        }
    }

    @Override
    public void stop() {
        if (this.listener != null) {
            this.listener.apply(null);
        }
        this.listener = null;
    }

    @Override
    public Future<Void> notifyUpsert(final UserInfos user, final JsonObject source) {
        final ExplorerMessage message = ExplorerMessage.upsert(getIdForModel(source), user, isForSearch()).withType(getApplication(), getResourceType());
        return toMessage(message, source).compose(messages -> {
            return communication.pushMessage(messages);
        });
    }

    @Override
    public Future<Void> notifyUpsert(final UserInfos user, final List<JsonObject> sources) {
        return toMessage(sources, e -> {
            final ExplorerMessage message = ExplorerMessage.upsert(getIdForModel(e), user, isForSearch()).withType(getApplication(), getResourceType());
            return message;
        }).compose(messages -> {
            return communication.pushMessage(messages);
        });
    }

    @Override
    public Future<Void> notifyUpsert(final ExplorerMessage m) {
        m.withType(getApplication(), getResourceType());
        return communication.pushMessage(Arrays.asList(m));
    }

    @Override
    public Future<Void> notifyUpsert(final List<ExplorerMessage> messages) {
        for(final ExplorerMessage m : messages){
            m.withType(getApplication(), getResourceType());
        }
        return communication.pushMessage(messages);
    }

    @Override
    public Future<Void> notifyDeleteById(final UserInfos user, final String id) {
        final ExplorerMessage message = ExplorerMessage.delete(id, user, isForSearch()).withType(getApplication(), getResourceType());
        return communication.pushMessage(message);
    }

    @Override
    public Future<Void> notifyDeleteById(final UserInfos user, final List<String> ids) {
        final List<ExplorerMessage> messages = ids.stream().map(id->{
            final ExplorerMessage message = ExplorerMessage.delete(id, user, isForSearch()).withType(getApplication(), getResourceType());
            return message;
        }).collect(Collectors.toList());
        return communication.pushMessage(messages);
    }

    @Override
    public Future<Void> notifyDelete(final UserInfos user, final JsonObject source) {
        final ExplorerMessage message = ExplorerMessage.delete(getIdForModel(source), user, isForSearch()).withType(getApplication(), getResourceType());
        return toMessage(message, source).compose(messages -> {
            return communication.pushMessage(messages);
        });
    }

    @Override
    public Future<Void> notifyDelete(final UserInfos user, final List<JsonObject> sources) {
        return toMessage(sources, e -> {
            final ExplorerMessage message = ExplorerMessage.delete(getIdForModel(e), user, isForSearch()).withType(getApplication(), getResourceType());
            return message;
        }).compose(messages -> {
            return communication.pushMessage(messages);
        });
    }


    protected Future<List<ExplorerMessage>> toMessage(final List<JsonObject> sources, final Function<JsonObject, ExplorerMessage> builder) {
        final List<Future> futures = sources.stream().map(e -> toMessage(builder.apply(e), e)).collect(Collectors.toList());
        return CompositeFuture.all(futures).map(e -> new ArrayList<ExplorerMessage>(e.list()));
    }

    @Override
    public final Future<String> create(final UserInfos user, final JsonObject source, final boolean isCopy){
        return doCreate(user, Arrays.asList(source), isCopy).compose(ids->{
            setIdForModel(source, ids.get(0));
            return notifyUpsert(user, source).map(ids);
        }).map(ids -> ids.get(0));
    }

    @Override
    public final Future<List<String>> create(final UserInfos user, final List<JsonObject> sources, final boolean isCopy){
        return doCreate(user, sources, isCopy).compose(ids->{
            for(int i = 0 ; i < ids.size(); i++){
                setIdForModel(sources.get(i), ids.get(i));
            }
            return notifyUpsert(user, sources).map(ids);
        }).map(ids -> ids);
    }

    @Override
    public final Future<Boolean> delete(final UserInfos user, final String id){
        return delete(user, Arrays.asList(id)).map(e-> e.get(0));
    }

    @Override
    public final Future<List<Boolean>> delete(final UserInfos user, final List<String> ids){
        return doDelete(user, ids).compose(oks->{
            final List<JsonObject> sources = ids.stream().map(id -> {
                final JsonObject source = new JsonObject();
                setIdForModel(source, id);
                return source;
            }).collect(Collectors.toList());
            return notifyDelete(user, sources).map(oks);
        });
    }

    @Override
    public IExplorerPluginCommunication getCommunication() {
        return communication;
    }

    //abstract
    protected abstract UserInfos getCreatorForModel(final JsonObject json);

    protected abstract String getIdForModel(final JsonObject json);

    protected abstract JsonObject setIdForModel(final JsonObject json, final String id);

    protected abstract String getApplication();

    protected abstract boolean isForSearch();

    protected abstract String getResourceType();

    protected abstract void doFetchForIndex(final ExplorerStream<JsonObject> stream, final Optional<Date> from, final Optional<Date> to);

    protected abstract Future<List<String>> doCreate(final UserInfos user, final List<JsonObject> sources, final boolean isCopy);

    protected abstract Future<List<Boolean>> doDelete(final UserInfos user, final List<String> ids);

    protected abstract Future<ExplorerMessage> toMessage(final ExplorerMessage message, final JsonObject source);

}
