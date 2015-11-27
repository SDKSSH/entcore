package org.entcore.registry.controllers;

import static fr.wseduc.webutils.request.RequestUtils.bodyToJson;
import static org.entcore.common.http.response.DefaultResponseHandler.arrayResponseHandler;
import static org.entcore.common.http.response.DefaultResponseHandler.defaultResponseHandler;
import static org.entcore.common.http.response.DefaultResponseHandler.notEmptyResponseHandler;

import java.util.List;

import org.entcore.common.http.filter.ResourceFilter;
import org.entcore.registry.filters.ApplicationFilter;
import org.entcore.registry.filters.SuperAdminFilter;
import org.entcore.registry.services.ExternalApplicationService;
import org.entcore.registry.services.impl.DefaultExternalApplicationService;
import org.vertx.java.core.Handler;
import org.vertx.java.core.http.HttpServerRequest;
import org.vertx.java.core.json.JsonObject;

import fr.wseduc.rs.*;
import fr.wseduc.security.ActionType;
import fr.wseduc.security.SecuredAction;
import fr.wseduc.webutils.http.BaseController;

public class ExternalApplicationController extends BaseController {
	private final ExternalApplicationService externalAppService = new DefaultExternalApplicationService();

	@Get("/external-applications")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void listExternalApplications(HttpServerRequest request) {
		String structureId = request.params().get("structureId");
		externalAppService.listExternalApps(structureId, arrayResponseHandler(request));
	}

	@Delete("/application/external/:id")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	@ResourceFilter(ApplicationFilter.class)
	public void deleteExternalApplication(final HttpServerRequest request) {
		String id = request.params().get("id");
		if (id != null && !id.trim().isEmpty()) {
			externalAppService.deleteExternalApplication(id, defaultResponseHandler(request, 204));
		} else {
			badRequest(request, "invalid.application.id");
		}
	}

	@Post("/application/external")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void createExternalApp(final HttpServerRequest request) {
		bodyToJson(request, pathPrefix + "createApplication", new Handler<JsonObject>() {
			@Override
			public void handle(JsonObject body) {
				String structureId = request.params().get("structureId");
				externalAppService.createExternalApplication(structureId, body, notEmptyResponseHandler(request, 201, 409));
			}
		});
	}

	@Put("/application/external/:id/lock")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	@ResourceFilter(SuperAdminFilter.class)
	public void lockExternalApp(final HttpServerRequest request) {
		String structureId = request.params().get("id");
		externalAppService.toggleLock(structureId, defaultResponseHandler(request));
	}

	@Put("/application/external/:id/authorize")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	@ResourceFilter(ApplicationFilter.class)
	public void authorizeProfiles(final HttpServerRequest request) {
		String applicationId = request.params().get("id");
		List<String> profiles = request.params().getAll("profile");

		if(profiles.isEmpty() || applicationId == null || applicationId.trim().isEmpty()){
			badRequest(request);
			return;
		}

		externalAppService.massAuthorize(applicationId, profiles, defaultResponseHandler(request));
	}

	@Delete("/application/external/:id/authorize")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	@ResourceFilter(ApplicationFilter.class)
	public void unauthorizeProfiles(final HttpServerRequest request) {
		String applicationId = request.params().get("id");
		List<String> profiles = request.params().getAll("profile");

		if(profiles.isEmpty() || applicationId == null || applicationId.trim().isEmpty()){
			badRequest(request);
			return;
		}

		externalAppService.massUnauthorize(applicationId, profiles, defaultResponseHandler(request, 204));
	}

}
