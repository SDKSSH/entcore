import { ng, idiom as lang, notify } from 'entcore'
import { archiveService } from '../../service'
import http from 'axios'

export let exportController = ng.controller('ExportController', ['$scope', ($scope) => {

	$scope.filePath = 'about:blank'
	var expected;

	archiveService.getApplications().then(data => {

		$scope.selectedApps = [];
		$scope.availableApps = data.activatedUserApps;
		$scope.isPreDeleted = data.isPreDeleted;
		expected = data.preDeletedUserApps;

		$scope.availableApps.forEach(app => { $scope.selectedApps[app] = false });
		$scope.selectedApps["workspace"] = true;
		$scope.selectedApps["rack"] = true;
		$scope.areAllSelected = function() {
			return $scope.availableApps.find(app => !$scope.selectedApps[app]) === undefined
		}
		$scope.areNoneSelected = function() {
			return $scope.availableApps.find(app => $scope.selectedApps[app]) === undefined
		}
		$scope.selectAll = function(event){
			let oneFalse = !$scope.areAllSelected()
			$scope.availableApps.forEach(app => { $scope.selectedApps[app] = oneFalse })
		}
		$scope.$apply();
	});

	$scope.initiateExport = function(mode: string){
		var appList;
		if (mode === "docsOnly") {
			appList = ["workspace","rack"];
		} else if (mode === "all") {
			appList = expected;
		} else if (mode === "apps") {
			appList = $scope.availableApps.filter(app => $scope.selectedApps[app]);
		}
		http.post('/archive/export', {'apps':appList}).then(function(res){
			$scope.loadingSpinner = true;
			setTimeout(function() {
				http.get('/archive/export/verify/' + res.data.exportId).then(function(status){
					window.location.href = '/archive/export/' + res.data.exportId;
					$scope.loadingSpinner = false;
					$scope.$apply();
				}).catch(function(){
					notify.error('archive.error');
					setTimeout(function() {
						window.location.reload();
					},3000);
				});
			},5000);
			$scope.loading = true;
			$scope.$apply();
		}).catch(function(){
			notify.error('export.already');
		})
	};
}]);