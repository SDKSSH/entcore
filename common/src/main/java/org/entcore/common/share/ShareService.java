/*
 * Copyright. Tous droits réservés. WebServices pour l’Education.
 */

package org.entcore.common.share;

import fr.wseduc.webutils.Either;
import org.vertx.java.core.Handler;
import org.vertx.java.core.json.JsonObject;

import java.util.List;

public interface ShareService {

	void shareInfos(String userId, String resourceId, String acceptLanguage,
					Handler<Either<String, JsonObject>> handler);

	void groupShare(String userId, String groupShareId, String resourceId, List<String> actions,
			Handler<Either<String, JsonObject>> handler);

	void userShare(String userId, String userShareId, String resourceId, List<String> actions,
			Handler<Either<String, JsonObject>> handler);

	void removeGroupShare(String groupId, String resourceId, List<String> actions,
			Handler<Either<String, JsonObject>> handler);

	void removeUserShare(String userId, String resourceId, List<String> actions,
			Handler<Either<String, JsonObject>> handler);

}
