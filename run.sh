#!/bin/bash
docker-compose up -d neo4j > /dev/null &
sleep 10
vertx runMod org.entcore~infra~2.2.1 > /dev/null &
