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

package org.entcore.common.share.impl;

import java.util.*;

import com.mongodb.QueryBuilder;
import fr.wseduc.mongodb.MongoQueryBuilder;
import io.vertx.core.Future;
import org.entcore.common.share.ShareInfosQuery;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;
import org.entcore.common.sql.SqlStatementsBuilder;

import fr.wseduc.webutils.Either;
import fr.wseduc.webutils.security.SecuredAction;
import io.vertx.core.AsyncResult;
import io.vertx.core.Handler;
import io.vertx.core.eventbus.EventBus;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

public class SqlShareService extends GenericShareService {

	private final Sql sql;
	private final String schema;
	private final String shareTable;

	public SqlShareService(EventBus eb, Map<String, SecuredAction> securedActions,
			Map<String, List<String>> groupedActions) {
		this(null, null, eb, securedActions, groupedActions);
	}

	public SqlShareService(String schema, String shareTable, EventBus eb, Map<String, SecuredAction> securedActions,
			Map<String, List<String>> groupedActions) {
		super(eb, securedActions, groupedActions);
		sql = Sql.getInstance();
		this.schema = (schema != null && !schema.trim().isEmpty()) ? schema + "." : "";
		this.shareTable = this.schema + ((shareTable != null && !shareTable.trim().isEmpty()) ? shareTable : "shares");
	}

	private Future<Set<String>[]> findUserIdsAndGroups(final String resourceId, final String currentUserId,
													   final Optional<Set<String>> actions) {
		Future<Set<String>[]> future = Future.future();
		final String query = "SELECT s.member_id, s.action, m.user_id, m.group_id FROM " + shareTable + " AS s " + "JOIN " + schema
				+ "members AS m ON s.member_id = m.id WHERE resource_id = ?";
		sql.prepared(query, new fr.wseduc.webutils.collections.JsonArray().add(Sql.parseId(resourceId)), sqlEvent -> {
			if ("ok".equals(sqlEvent.body().getString("status"))) {
				JsonArray shared = sqlEvent.body().getJsonArray("results", new JsonArray());
				Set<String> userIds = new HashSet<>();
				Set<String> groupIds = new HashSet<>();
				final int actionCount = actions.map(s->s.size()).orElse(0);
				final Map<String, Set<String>>  countActions = new HashMap<>();
				for (Object jsonO : shared) {
					if (!(jsonO instanceof JsonArray))
						continue;
					//
					JsonArray json = (JsonArray) jsonO;
					//final String memberId = json.getString(0);
					final String action = json.getString(1);
					final String userId = json.getString(2);
					final String groupId = json.getString(3);
					final boolean isUser = userId != null;
					final String id = isUser ? userId : groupId;
					// filter by actions
					boolean accept = true;
					if (actions.isPresent() && actions.get().size() > 0) {
						// if one action is absent...ignore
						countActions.putIfAbsent(id,new HashSet<>());
						countActions.compute(id, (k,v) -> {
							if(actions.get().contains(action)) v.add(action);
							return v;
						});
						accept = countActions.get(id).size() >= actionCount;
					}
					//
					if (accept) {
						if (isUser) {
							userIds.add(userId);
						} else if (groupId != null) {
							groupIds.add(groupId);
						}
					}
				}
				//
				future.complete(new Set[] { userIds, groupIds });
			} else {
				future.fail("Error finding shared resource.");
			}
		});
		return future;
	}

	@Override
	public void inheritShareInfos(String userId, String resourceId, String acceptLanguage, String search,
			Handler<Either<String, JsonObject>> handler) {
		// TODO implement inherit shares
		throw new UnsupportedOperationException("Postgres not implemented yet");
	}

	@Override
	public void findUserIdsForInheritShare(String resourceId, String userId, Optional<Set<String>> actions,
			Handler<AsyncResult<Set<String>>> h) {
		// TODO Auto-generated method stub
		throw new UnsupportedOperationException("Postgres not implemented yet");
	}

	@Override
	public void findUserIdsForShare(String resourceId, String userId, Optional<Set<String>> actions,
			Handler<AsyncResult<Set<String>>> h) {
		findUserIdsAndGroups(resourceId, userId, actions).compose(ids -> {
			Set<String> userIds = ids[0];
			Set<String> groupIds = ids[1];
			return userIdsForGroupIds(groupIds, userId).map(uids -> {
				Set<String> all = new HashSet<>();
				all.addAll(userIds);
				all.addAll(uids);
				// ignore current user
				all.remove(userId);
				return all;
			});
		}).setHandler(h);
	}

	@Override
	public void shareInfosWithoutVisible(final String userId, final String resourceId, final Handler<Either<String, JsonArray>> handler) {
		if (userId == null || userId.trim().isEmpty()) {
			handler.handle(new Either.Left<String, JsonArray>("Invalid userId."));
			return;
		}
		if (resourceId == null || resourceId.trim().isEmpty()) {
			handler.handle(new Either.Left<String, JsonArray>("Invalid resourceId."));
			return;
		}
		final JsonArray actions = getResoureActions(securedActions);
		String query = "SELECT s.member_id, s.action, m.group_id FROM " + shareTable + " AS s " + "JOIN " + schema
				+ "members AS m ON s.member_id = m.id WHERE resource_id = ?";
		sql.prepared(query, new JsonArray().add(Sql.parseId(resourceId)),message -> {
			if ("ok".equals(message.body().getString("status"))) {
				final JsonArray res = message.body().getJsonArray("results");
				final JsonArray shared = new JsonArray();
				final Map<String, JsonObject> sharedById = new HashMap();
				for (Object r : res) {
					if (!(r instanceof JsonArray))
						continue;
					final JsonArray row = (JsonArray) r;
					final String memberId = row.getString(0);
					final String actionId = row.getString(1);
					final String groupId = row.getString(2);
					if(groupId != null){
						//group
						final String key = "GROUP_"+groupId;
						final JsonObject share = sharedById.getOrDefault(key, new JsonObject().put("groupId", groupId));
						share.put(actionId, true);
						if(!sharedById.containsKey(key)){
							shared.add(share);
							sharedById.put(key, share);
						}
					}else if(memberId != null){
						//user
						final String key = "USER_"+memberId;
						final JsonObject share = sharedById.getOrDefault(key, new JsonObject().put("userId", memberId));
						share.put(actionId, true);
						if(!sharedById.containsKey(key)){
							shared.add(share);
							sharedById.put(key, share);
						}
					}
				}
				handler.handle(new Either.Right<>(shared));
			}else{
				final String error = message.body().getString("error", "Error finding shared resource.");
				handler.handle(new Either.Left<>(error));
			}
		});
	}

	@Override
	public void shareInfos(final String userId, String resourceId, final String acceptLanguage, final ShareInfosQuery search,
			final Handler<Either<String, JsonObject>> handler) {
		if (userId == null || userId.trim().isEmpty()) {
			handler.handle(new Either.Left<String, JsonObject>("Invalid userId."));
			return;
		}
		if (resourceId == null || resourceId.trim().isEmpty()) {
			handler.handle(new Either.Left<String, JsonObject>("Invalid resourceId."));
			return;
		}
		final JsonArray actions = getResoureActions(securedActions);
		String query = "SELECT s.member_id, s.action, m.group_id FROM " + shareTable + " AS s " + "JOIN " + schema
				+ "members AS m ON s.member_id = m.id WHERE resource_id = ?";
		sql.prepared(query, new fr.wseduc.webutils.collections.JsonArray().add(Sql.parseId(resourceId)),
				new Handler<Message<JsonObject>>() {
					@Override
					public void handle(Message<JsonObject> message) {
						if ("ok".equals(message.body().getString("status"))) {
							JsonArray r = message.body().getJsonArray("results");
							JsonObject groupCheckedActions = new JsonObject();
							JsonObject userCheckedActions = new JsonObject();
							for (Object o : r) {
								if (!(o instanceof JsonArray))
									continue;
								JsonArray row = (JsonArray) o;
								final String memberId = row.getString(0);
								if (memberId == null || memberId.equals(userId))
									continue;
								final JsonObject checkedActions = (row.getValue(2) != null) ? groupCheckedActions
										: userCheckedActions;
								JsonArray m = checkedActions.getJsonArray(memberId);
								if (m == null) {
									m = new fr.wseduc.webutils.collections.JsonArray();
									checkedActions.put(memberId, m);
								}
								m.add(row.getValue(1));
							}
							getShareInfos(userId, actions, groupCheckedActions, userCheckedActions, acceptLanguage,
									search, new Handler<JsonObject>() {
										@Override
										public void handle(JsonObject event) {
											if (event != null && event.size() == 3) {
												handler.handle(new Either.Right<String, JsonObject>(event));
											} else {
												handler.handle(new Either.Left<String, JsonObject>(
														"Error finding shared resource."));
											}
										}
									});
						}
					}
				});
	}

	@Override
	public void groupShare(final String userId, final String groupShareId, final String resourceId,
			final List<String> actions, final Handler<Either<String, JsonObject>> handler) {
		inShare(resourceId, groupShareId, new Handler<Boolean>() {

			@Override
			public void handle(Boolean event) {
				if (Boolean.TRUE.equals(event)) {
					share(resourceId, groupShareId, actions, "groups", handler);
				} else {
					groupShareValidation(userId, groupShareId, actions, new Handler<Either<String, JsonObject>>() {
						@Override
						public void handle(Either<String, JsonObject> event) {
							if (event.isRight()) {
								share(resourceId, groupShareId, actions, "groups", handler);
							} else {
								handler.handle(event);
							}
						}
					});
				}
			}
		});
	}

	private void inShare(String resourceId, String shareId, final Handler<Boolean> handler) {
		String query = "SELECT count(*) FROM " + shareTable + " WHERE resource_id = ? AND member_id = ?";
		JsonArray params = new fr.wseduc.webutils.collections.JsonArray().add(Sql.parseId(resourceId)).add(shareId);
		sql.prepared(query, params, new Handler<Message<JsonObject>>() {
			@Override
			public void handle(Message<JsonObject> message) {
				Long count = SqlResult.countResult(message);
				handler.handle(count != null && count > 0);
			}
		});
	}

	@Override
	public void userShare(final String userId, final String userShareId, final String resourceId,
			final List<String> actions, final Handler<Either<String, JsonObject>> handler) {
		inShare(resourceId, userShareId, new Handler<Boolean>() {
			@Override
			public void handle(Boolean event) {
				if (Boolean.TRUE.equals(event)) {
					share(resourceId, userShareId, actions, "users", handler);
				} else {
					userShareValidation(userId, userShareId, actions, new Handler<Either<String, JsonObject>>() {
						@Override
						public void handle(Either<String, JsonObject> event) {
							if (event.isRight()) {
								share(resourceId, userShareId, actions, "users", handler);
							} else {
								handler.handle(event);
							}
						}
					});
				}
			}
		});
	}

	@Override
	public void removeGroupShare(String groupId, String resourceId, List<String> actions,
			Handler<Either<String, JsonObject>> handler) {
		removeShare(resourceId, groupId, actions, handler);
	}

	@Override
	public void removeUserShare(String userId, String resourceId, List<String> actions,
			Handler<Either<String, JsonObject>> handler) {
		removeShare(resourceId, userId, actions, handler);
	}

	@Override
	public Future<JsonObject> share(String userId, String resourceId, JsonObject share, Handler<Either<String, JsonObject>> handler) {
		final Future<JsonObject> futureValidateShares = Future.future();
		shareValidation(resourceId, userId, share, res -> {
			if (res.isRight()) {
				final SqlStatementsBuilder s = new SqlStatementsBuilder();
				s.prepared("SELECT member_id FROM " + shareTable + " WHERE resource_id = ?",
						new JsonArray().add(Sql.parseId(resourceId)));
				s.prepared("DELETE FROM " + shareTable + " WHERE resource_id = ?", new JsonArray().add(Sql.parseId(resourceId)));
				final JsonArray users = res.right().getValue().getJsonArray("users");
				if (users != null && users.size() > 0) {
					s.raw("LOCK TABLE " + schema + "users IN SHARE ROW EXCLUSIVE MODE");
					for (Object u : users) {
						s.raw("INSERT INTO " + schema + "users (id) SELECT '" + u.toString()
								+ "' WHERE NOT EXISTS (SELECT * FROM " + schema + "users WHERE id='" + u.toString()
								+ "');");
					}
				}
				final JsonArray groups = res.right().getValue().getJsonArray("groups");
				if (groups != null && groups.size() > 0) {
					s.raw("LOCK TABLE " + schema + "groups IN SHARE ROW EXCLUSIVE MODE");
					for (Object g : groups) {
						s.raw("INSERT INTO " + schema + "groups (id) SELECT '" + g.toString()
								+ "' WHERE NOT EXISTS (SELECT * FROM " + schema + "groups WHERE id='" + g.toString()
								+ "');");
					}
				}
				s.insert(shareTable, new JsonArray().add("member_id").add("resource_id").add("action"),
						res.right().getValue().getJsonArray("shared"));
				sql.transaction(s.build(), SqlResult.validResultHandler(0, old -> {
					if (old.isRight()) {
						JsonArray oldMembers = old.right().getValue();
						JsonArray members = res.right().getValue().getJsonArray("notify-members");
						getNotifyMembers(handler, oldMembers, members, (m -> ((JsonObject) m).getString("member_id")));
					} else {
						handler.handle(new Either.Left<>(old.left().getValue()));
					}
				}));
				futureValidateShares.complete(res.right().getValue());
			} else {
				handler.handle(res);
				futureValidateShares.fail(res.left().getValue());
			}
		});
		return futureValidateShares;
	}

	private void removeShare(String resourceId, String userId, List<String> actions,
			Handler<Either<String, JsonObject>> handler) {
		String actionFilter;
		JsonArray values;
		if (actions != null && actions.size() > 0) {
			Object[] a = actions.toArray();
			actionFilter = "action IN " + Sql.listPrepared(a) + " AND ";
			values = new fr.wseduc.webutils.collections.JsonArray(actions);
		} else {
			actionFilter = "";
			values = new fr.wseduc.webutils.collections.JsonArray();
		}
		String query = "DELETE FROM " + shareTable + " WHERE " + actionFilter + "resource_id = ? AND member_id = ?";
		values.add(Sql.parseId(resourceId)).add(userId);
		sql.prepared(query, values, SqlResult.validUniqueResultHandler(handler));
	}

	private void share(String resourceId, final String shareId, List<String> actions, final String membersTable,
			final Handler<Either<String, JsonObject>> handler) {
		final SqlStatementsBuilder s = new SqlStatementsBuilder();
		s.raw("LOCK TABLE " + schema + membersTable + " IN SHARE ROW EXCLUSIVE MODE");
		s.raw("LOCK TABLE " + shareTable + " IN SHARE ROW EXCLUSIVE MODE");
		s.raw("INSERT INTO " + schema + membersTable + " (id) SELECT '" + shareId + "' WHERE NOT EXISTS (SELECT * FROM "
				+ schema + membersTable + " WHERE id='" + shareId + "');");
		final Object rId = Sql.parseId(resourceId);
		final String query = "INSERT INTO " + shareTable
				+ " (member_id, resource_id, action) SELECT ?, ?, ? WHERE NOT EXISTS " + "(SELECT * FROM " + shareTable
				+ " WHERE member_id = ? AND resource_id = ? AND action = ?);";
		for (String action : actions) {
			JsonArray ar = new fr.wseduc.webutils.collections.JsonArray().add(shareId).add(rId).add(action).add(shareId)
					.add(rId).add(action);
			s.prepared(query, ar);
		}
		sql.prepared("SELECT count(*) FROM " + shareTable + " WHERE member_id = ? AND resource_id = ?",
				new fr.wseduc.webutils.collections.JsonArray().add(shareId).add(Sql.parseId(resourceId)),
				new Handler<Message<JsonObject>>() {
					@Override
					public void handle(final Message<JsonObject> message) {
						final Long nb = SqlResult.countResult(message);
						sql.transaction(s.build(), new Handler<Message<JsonObject>>() {
							@Override
							public void handle(Message<JsonObject> res) {
								Either<String, JsonObject> r = SqlResult.validUniqueResult(2, res);
								if (r.isRight() && nb == 0) {
									JsonObject notify = new JsonObject();
									notify.put(membersTable.substring(0, membersTable.length() - 1) + "Id", shareId);
									r.right().getValue().put("notify-timeline", notify);
								}
								handler.handle(r);
							}
						});
					}
				});
	}

	public static void removeShareMetadata(JsonObject data)
	{
		//Nothing to do, share metadata isn't stored in data objects but in the share table
	}

	@Override
	protected void prepareSharedArray(String resourceId, String type, JsonArray shared, String attr,
			Set<String> actions) {
		for (String action : actions) {
			shared.add(new JsonArray().add(attr).add(resourceId).add(action));
		}

	}

}
