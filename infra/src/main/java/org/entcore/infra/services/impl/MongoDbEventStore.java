/*
 * Copyright © "Open Digital Education", 2014
 *
 * This program is published by "Open Digital Education".
 * You must indicate the name of the software and the company in any production /contribution
 * using the software and indicate on the home page of the software industry in question,
 * "powered by Open Digital Education" with a reference to the website: https://opendigitaleducation.com/.
 *
 * This program is free software, licensed under the terms of the GNU Affero General Public License
 * as published by the Free Software Foundation, version 3 of the License.
 *
 * You can redistribute this application and/or modify it since you respect the terms of the GNU Affero General Public License.
 * If you modify the source code and then use this modified source code in your creation, you must make available the source code of your modifications.
 *
 * You should have received a copy of the GNU Affero General Public License along with the software.
 * If not, please see : <http://www.gnu.org/licenses/>. Full compliance requires reading the terms of this license and following its directives.

 */

package org.entcore.infra.services.impl;

import fr.wseduc.mongodb.MongoDb;
import fr.wseduc.webutils.Either;
import fr.wseduc.webutils.http.Renders;
import fr.wseduc.webutils.request.CookieHelper;
import io.vertx.core.http.HttpServerRequest;

import org.entcore.common.events.impl.PostgresqlEventStore;
import org.entcore.common.user.UserInfos;
import org.entcore.infra.services.EventStoreService;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonObject;

public class MongoDbEventStore implements EventStoreService {

	private MongoDb mongoDb = MongoDb.getInstance();
	private PostgresqlEventStore pgEventStore;
	private static final String COLLECTION = "events";

	public MongoDbEventStore(Vertx vertx) {
		final String eventStoreConf = (String) vertx.sharedData().getLocalMap("server").get("event-store");
		if (eventStoreConf != null) {
			final JsonObject eventStoreConfig = new JsonObject(eventStoreConf);
			if (eventStoreConfig.containsKey("postgresql")) {
				pgEventStore =  new PostgresqlEventStore();
				pgEventStore.setEventBus(vertx.eventBus());
				pgEventStore.setModule("infra");
				pgEventStore.setVertx(vertx);
				pgEventStore.init();
			}
		}
	}

	@Override
	public void store(JsonObject event, final Handler<Either<String, Void>> handler) {
		mongoDb.save(COLLECTION, event, new Handler<Message<JsonObject>>() {
			@Override
			public void handle(Message<JsonObject> event) {
				if ("ok".equals(event.body().getString("status"))) {
					handler.handle(new Either.Right<String, Void>(null));
				} else {
					handler.handle(new Either.Left<String, Void>(
							"Error : " + event.body().getString("message") + ", Event : " + event));
				}
			}
		});
		if (pgEventStore != null) {
			pgEventStore.store(event.copy(), ar -> {
			});
		}
	}

	@Override
	public void generateMobileEvent(String eventType, UserInfos user, HttpServerRequest request,
									 String module, final Handler<Either<String, Void>> handler) {
		JsonObject event = new JsonObject();
		event.put("event-type", eventType)
				.put("module", module)
				.put("date", System.currentTimeMillis());
		if (user != null) {
			event.put("userId", user.getUserId());
			if (user.getType() != null) {
				event.put("profil", user.getType());
			}
			if (user.getStructures() != null) {
				event.put("structures", new fr.wseduc.webutils.collections.JsonArray(user.getStructures()));
			}
			if (user.getClasses() != null) {
				event.put("classes", new fr.wseduc.webutils.collections.JsonArray(user.getClasses()));
			}
			if (user.getGroupsIds() != null) {
				event.put("groups", new fr.wseduc.webutils.collections.JsonArray(user.getGroupsIds()));
			}
			if (request.headers().get("User-Agent") != null) {
				event.put("ua", request.headers().get("User-Agent"));
			}
		}
		if (request != null) {
			event.put("referer", request.headers().get("Referer"));
			event.put("sessionId", CookieHelper.getInstance().getSigned("oneSessionId", request));

			final String ip = Renders.getIp(request);
			if (ip != null) {
				event.put("ip", ip);
			}
		}
		store(event, handler);
	}

	@Override
	public void storeCustomEvent(String baseEventType, JsonObject payload) {
		if (pgEventStore != null) {
			pgEventStore.storeCustomEvent(baseEventType, payload);
		}
	}

}
