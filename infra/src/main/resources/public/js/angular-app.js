var protoApp = {
  scope : '#main',
			init : function() {
			var that = this;
			that.i18n.load();
			$('body').delegate(that.scope, 'click',function(event) {
					if (!event.target.getAttribute('call')) return;
					event.preventDefault();
					if(event.target.getAttribute('disabled') !== null){
							return;
						}
					var call = event.target.getAttribute('call');
					that.action[call]({url : event.target.getAttribute('href'), target: event.target});
					event.stopPropagation();
				});
		},
	action : {
		},
	template : {
			getAndRender : function (pathUrl, templateName, elem, dataExtractor){
					var that = this;
					if (_.isUndefined(dataExtractor)) {
								dataExtractor = function (d) { return {list : _.values(d.result)}; };
						}
					$.get(pathUrl)
						.done(function(data) {
								$(elem).html(that.render(templateName, dataExtractor(data)));
							})
					.error(function(data) {
								protoApp.notify.error(data);
							});
				},
			render : function (name, data) {
					_.extend(data, {
								'i18n' : protoApp.i18n.i18n,
								'formatDate' : function() {
								return function(str) {
										var dt = new Date(Mustache.render(str, this).replace('CEST', 'EST')).toShortString();
										return dt;
									};
							},
						'formatDateTime' : function() {
								return function(str) {
										var dt = new Date(Mustache.render(str, this).replace('CEST', 'EST')).toShortString();
										return dt;
									};
							},
						longDate: function(){
								return function(date) {
										var momentDate = moment(Mustache.render(date, this).replace('CEST', 'EST'));
										if(momentDate !== null){
												return momentDate.format('D MMMM YYYY');
											}
									};
							},
						longDay: function(){
							return function(date) {
										var momentDate = moment(Mustache.render(date, this).replace('CEST', 'EST'));
										if(momentDate !== null){
												return momentDate.format('D MMMM');
											}
									};
							}
					});
				return Mustache.render(this[name] === undefined ? name : this[name], data);
			}
	},
	notify : {
			done : function (msg) { this.instance('success')(msg);},
			error : function (msg) { this.instance('error')(msg); },
			warn : function (msg) {},
			info : function (msg) { this.instance('info')(msg); },
			instance : function(level) {
					return humane.spawn({ addnCls: 'humane-original-' + level });
				}
		},
	i18n : {
			load : function () {
					var that = this;
					$.ajax({url: 'i18n', async: false})
						.done(function(data){
									that.bundle = data;
							})
				},
			bundle : {},
			i18n : function() {
					return function(key) {
								key = Mustache.render(key, this);
							return protoApp.i18n.bundle[key] === undefined ? key : protoApp.i18n.bundle[key];
						};
				},
			translate: function(key){
					return this.i18n()(key);
				}
		},
	define : function (o) {
			var props = { template : {}, action:{}};
			for (prop in props) {
					for (key in o[prop]) {
								props[[prop]][key] = {'value' : o[[prop]][key]};
						}
					Object.defineProperties(this[prop], props[[prop]]);
				}
		}
};

var notify = {
	message: function(type, message){
		message = lang.translate(message);
		humane.spawn({ addnCls: 'humane-original-' + type })(message);
	},
	error: function(message){
		this.message('error', message);
	},
	info: function(message){
		this.message('info', message)
	}
};

var module = angular.module('app', ['ngSanitize', 'ngRoute'], function($interpolateProvider) {
		$interpolateProvider.startSymbol('[[');
		$interpolateProvider.endSymbol(']]');
	})
	.factory('notify', function(){
		return notify;
	})
	.factory('route', function($rootScope, $route, $routeParams){
		var routes = {};

		$rootScope.$on("$routeChangeSuccess", function($currentRoute, $previousRoute){
			if(typeof routes[$route.current.action] === 'function'){
				routes[$route.current.action]($routeParams);
			}
		});

		return function(setRoutes){
			routes = setRoutes;
		}
	})
	.factory('views', function(){
		return {
			viewPath: '/' + appPrefix + '/public/template/',
			containers: {},
			openView: function(view, name){
				if(name === 'lightbox' && view === ''){
					ui.hideLightbox()
				}
				else if(name === 'lightbox'){
					ui.showLightbox();
				}
				this.containers[name] = this.viewPath + view + '.html';
			},
			containsView: function(name, view){
				return $scope.viewsContainers[name] === this.viewPath + view + '.html';
			}
		}
	})
	.factory('date', function() {
		if(window.moment === undefined){
			loader.syncLoad('moment');
		}

		if(currentLanguage === 'fr'){
			moment.lang(currentLanguage, {
				calendar : {
					lastDay : '[Hier à] HH[h]mm',
					sameDay : '[Aujourd\'hui à] HH[h]mm',
					nextDay : '[Demain à] HH[h]mm',
					lastWeek : 'dddd [dernier à] HH[h]mm',
					nextWeek : 'dddd [prochain à] HH[h]mm',
					sameElse : 'dddd LL'
				}
			});
		}
		else{
			moment.lang(currentLanguage);
		}

		return {
			format: function(date, format) {
				if(!moment){
					return '';
				}
				return moment(date).format(format);
			},
			calendar: function(date){
				if(!moment){
					return '';
				}
				return moment(date).calendar();
			}
		};
	})
	.factory('lang', function(){
		return lang
	})
	.factory('_', function(){
		if(window._ === undefined){
			loader.syncLoad('underscore');
		}
		return _;
	})
	.factory('model', function(){
		return model;
	})
	.factory('ui', function(){
		return ui;
	});

//routing
if(routes.routing){
	module.config(routes.routing);
}

//directives

module.directive('completeChange', function() {
	return {
		restrict: 'A',
		scope:{
			exec: '&completeChange',
			field: '=ngModel'
		},
		link: function($scope, $linkElement, $attributes) {
			$scope.$watch('field', function(newVal) {
				$linkElement.val(newVal);
				if($linkElement[0].type === 'textarea' && $linkElement.hasClass('inline-editing')){
					setTimeout(function(){
						$linkElement.height(1);
						$linkElement.height($linkElement[0].scrollHeight - 1);
					}, 500);

				}
			});

			$linkElement.bind('change', function() {
				$scope.field = $linkElement.val();
				if(!$scope.$$phase){
					$scope.$apply('field');
				}
				$scope.$parent.$eval($scope.exec);

			});
		}
	};
});

module.directive('lightbox', function($compile){
	return {
		restrict: 'E',
		transclude: true,
		scope: {
			show: '='
		},
		template: '<div>\
					<section class="lightbox-backdrop"></section>\
					<section class="lightbox-window five cell">\
						<div class="twelve cell" ng-transclude></div>\
						<div class="close-lightbox">\
						<i role="close-2x"></i>\
						</div>\
						<div class="clear"></div>\
					</section>\
				</div>',
		link: function(scope, element, attributes){
			scope.$watch('visible', function(newVal){
				if(newVal){
					element.find('.lightbox-window').fadeIn();
				}
				else{
					element.find('.lightbox-window').fadeOut();
				}
			})
		}
	}
});

module.directive('documentsLibrary', function($compile){
	return {
		restrict: 'E',
		scope: {

		},
		templateUrl: '/infra/public/template/documents-library.html',
		link: function(scope, element, attributes){

		}
	}
});

module.directive('fileInputChange', function($compile){
	return {
		restrict: 'A',
		scope: {
			fileInputChange: '&',
			file: '=ngModel'
		},
		link: function($scope, $element){
			$element.bind('change', function(){
				$scope.file = $element[0].files[0];
				$scope.$apply();
				$scope.fileInputChange();
				$scope.$apply();
			})
		}
	}
});

module.directive('filesPicker', function($compile){
	return {
		restrict: 'E',
		transclude: true,
		replace: true,
		template: '<input type="button" ng-transclude />',
		scope: {
			ngChange: '&',
			ngModel: '='
		},
		link: function($scope, $element, $attributes){
			$element.on('click', function(){
				var fileSelector = $('<input />', {
					type: 'file'
				})
					.hide()
					.appendTo('body');

				fileSelector.on('change', function(){
					$scope.ngModel = fileSelector[0].files;
					$scope.$apply();
					$scope.$eval($scope.ngChange);
					$scope.$parent.$apply();
				});
				fileSelector.click();
			});
		}
	}
})

module.directive('filesInputChange', function($compile){
	return {
		restrict: 'A',
		scope: {
			filesInputChange: '&',
			file: '=ngModel'
		},
		link: function($scope, $element){
			$element.bind('change', function(){
				$scope.file = $element[0].files;
				$scope.$apply();
				$scope.filesInputChange();
				$scope.$apply();
			})
		}
	}
})

module.directive('iconsSelect', function($compile) {
	return {
		restrict: 'E',
		scope:{
			options: '=',
			class: '@',
			current: '=',
			change: '&'
		},
		link: function($scope, $element, $attributes){
			$element.bind('change', function(){
				$scope.current.id = $element.find('.current').data('selected');
				$scope.$eval($scope.change);
				$element.unbind('change');
			})
		},
		template: '\
			<div>\
				<div class="current fixed cell twelve" data-selected="[[current.id]]">\
					<i role="[[current.icon]]"></i>\
					<span>[[current.text]]</span>\
				</div>\
				<div class="options-list icons-view">\
				<div class="cell three option" data-value="[[option.id]]" data-ng-repeat="option in options">\
					<i role="[[option.icon]]"></i>\
					<span>[[option.text]]</span>\
				</div>\
				</div>\
			</div>'
	};
});

module.directive('translate', function($compile) {
	return {
		restrict: 'A',
		replace: true,
		link: function ($scope, $element, $attributes) {
			if($attributes.params){
				var params = $scope.$eval($attributes.params);
				for(var i = 0; i < params.length; i++){
					$scope[i] = params[i];
				}
			}

			$attributes.$observe('content', function(val) {
				if(!$attributes.content){
					return;
				}
				$element.html($compile('<span class="no-style">' + lang.translate($attributes.content) + '</span>')($scope));
			});

			$attributes.$observe('attr', function(val) {
				if(!$attributes.attr){
					return;
				}
				var compiled = $compile('<span>' + lang.translate($attributes[$attributes.attr]) + '</span>')($scope);
				setTimeout(function(){
					$element.attr($attributes.attr, compiled.text());
				}, 10);
			});

			$attributes.$observe('key', function(val) {
				if(!$attributes.key){
					return;
				}
				$element.html($compile('<span class="no-style">' + lang.translate($attributes.key) + '</span>')($scope));
			});
		}
	};
});

module.directive('translateAttr', function($compile) {
	return {
		restrict: 'A',
		link: function compile($scope, $element, $attributes) {
			var compiled = $compile('<span>' + lang.translate($attributes[$attributes.translateAttr]) + '</span>')($scope);
			setTimeout(function(){
				$element.attr($attributes.translateAttr, compiled.text());
			}, 10);
		}
	};
});

module.directive('preview', function($compile){
	return {
		restrict: 'E',
		template: '<div class="row content-line"><div class="row fixed-block height-four">' +
			'<div class="four cell fixed image clip text-container"></div>' +
			'<div class="eight cell fixed-block left-four paragraph text-container"></div>' +
			'</div></div>',
		replace: true,
		scope: {
			content: '='
		},
		link: function($scope, $element, $attributes){
				$scope.$watch('content', function(newValue){
					var fragment = $(newValue);
					$element.find('.image').html(fragment.find('img').first());

					var paragraph = _.find(fragment.find('p'), function(node){
						return $(node).text().length > 0;
					});
					$element.find('.paragraph').text($(paragraph).text());
				})
			}
		}
})

module.directive('bindHtmlUnsafe', function($compile){
	return {
		restrict: 'A',
		scope: {
			bindHtmlUnsafe: '='
		},
		link: function($scope, $element){
			$scope.$watch('bindHtmlUnsafe', function(newVal){
				$element.html($compile('<div>' + newVal + '</div>')($scope.$parent));
				//weird browser bug with audio tags
				$element.find('audio').each(function(index, item){
					var parent = $(item).parent();
					$(item)
						.attr("src", item.src)
						.detach()
						.appendTo(parent);
				});
			});
		}
	}
});

module.directive('portal', function($compile){
	var skin = 'raw';
	var theme = '/assets/themes/raw/default/';
	var template = '/assets/themes/raw/portal.html';
	var logout = '/';
	http().get('/theme', {}, {
		async: false,
		success: function(data){
			logout = data.logoutCallback;
			theme = data.skin;
			skin = theme.split('/assets/themes/')[1].split('/')[0];
			template = '/assets/themes/' + skin + '/portal.html';
		}
	});
	return {
		restrict: 'E',
		transclude: true,
		templateUrl: template,
		compile: function($element, $attribute, $transclude){
			$('[logout]').attr('href', '/auth/logout?callback=' + logout);
			ui.setStyle(theme);
		}
	}
});

module.directive('adminPortal', function($compile){
	var skin = 'admin';
	var theme = '/assets/themes/admin/default/';
	var template = '/assets/themes/admin/portal.html';
	var logout = '/';
	return {
		restrict: 'E',
		transclude: true,
		templateUrl: template,
		compile: function($element, $attribute, $transclude){
			$('[logout]').attr('href', '/auth/logout?callback=' + logout);
			ui.setStyle(theme);
		}
	}
});

module.directive('portalStyles', function($compile){
	return {
		restrict: 'E',
		compile: function($element, $attribute){
			var rand = Math.random();
			$.get('/theme?token=' + rand, function(data){
				var css = data.skin;
				$('[logout]').attr('href', '/auth/logout?callback=' + data.logoutCallback)
				ui.setStyle(css);
			})
		}
	}
});

module.directive('skinSrc', function($compile){
	return {
		restrict: 'A',
		scope: '&',
		link: function($scope, $element, $attributes){
			if(!$('#theme').attr('href')){
				return;
			}
			var skinPath = $('#theme').attr('href').split('/');
			var path = skinPath.slice(0, skinPath.length - 2).join('/');
			$element.attr('src', path + $attributes.skinSrc);
		}
	}
})

module.directive('localizedClass', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $attributes, $element){
			$element.$addClass(currentLanguage);
		}
	}
});

module.directive('dropDown', function($compile, $timeout){
	return {
		restrict: 'E',
		transclude: true,
		replace: true,
		scope: {
			options: '=',
			change: '&',
			current: '='
		},
		template: '<div data-drop-down class="drop-down">\
						<div>\
							<ul class="ten cell right-magnet">\
								<li ng-repeat="option in options | limitTo:10" ng-model="option">[[option.toString()]]</li>\
							</ul>\
						</div>\
			</div>',
		link: function($scope, $element, $attributes){
			$scope.$watchCollection('options', function(newValue){
				if(!$scope.options || $scope.options.length === 0){
					$element.addClass('hidden');
					return;
				}
				$element.removeClass('hidden');
				var linkedInput = $('#' + $attributes.for);
				var pos = linkedInput.offset();
				var width = linkedInput.width() +
					parseInt(linkedInput.css('padding-right')) +
					parseInt(linkedInput.css('padding-left')) +
					parseInt(linkedInput.css('border-width') || 1) * 2;
				var height = linkedInput.height() +
					parseInt(linkedInput.css('padding-top')) +
					parseInt(linkedInput.css('padding-bottom')) +
					parseInt(linkedInput.css('border-height') || 1) * 2;

				pos.top = pos.top + height;
				$element.offset(pos);
				$element.width(width);
			})
			$element.parent().on('remove', function(){
				$element.remove();
			})
			$element.detach().appendTo('body');


			$element.on('click', 'li', function(e){
				$scope.current = $(this).scope().option;
				$scope.$apply('current');
				$scope.$eval($scope.change);
				$scope.$apply('current');
			});
			$element.attr('data-opened-drop-down', true);

		}
	}
})

function createCKEditorInstance(editor, $scope, $compile){
	var positionning = function(){
		$('.cke_chrome').width(editor.width() + 2 + parseInt(editor.css('padding') || 4) * 2);
		$('.cke_chrome').offset({
			top: editor.offset().top - $('.cke_chrome').height(),
			left: editor.offset().left
		});
		$('<style></style>').text('.cke_chrome{' +
			'top:' + (editor.offset().top - $('.cke_chrome').height()) + 'px !important;' +
			'left:' + editor.offset().left + 'px !important;' +
			'position: absolute !important;' +
			'display: block !important' +
			'}').appendTo('head');

	};

	CKEDITOR.on('instanceReady', function(ck){
		editor.focus();
		editor.html($compile($scope.ngModel)($scope.$parent));
		$scope.$parent.$apply();
		setTimeout(function(){
			$('input').first().focus();
		}, 500);

		if($scope.ngModel && $scope.ngModel.indexOf('<img') !== -1){
			$('img').on('load', positionning);
		}
		else{
			positionning();
		}
		editor.on('focus', function(){
			positionning();
		});
	});

	$scope.$watch('ngModel', function(newValue){
		if(editor.html() !== newValue){
			editor.html($compile(newValue)($scope.$parent));
			//weird browser bug with audio tags
			editor.find('audio').each(function(index, item){
				var parent = $(item).parent();
				$(item)
					.attr("src", item.src)
					.detach()
					.appendTo(parent);
			});
		}
	});

	editor.on('blur', function(e) {
		var content = editor.html();
		if(content.indexOf(';base64,') !== -1){
			$scope.notify.error('Une image est corrompue')
		}
		editor.find('img').each(function(index, item){
			if($(item).attr('src').indexOf(';base64,') !== -1){
				$(item).remove();
			}
		})
		$scope.ngModel = editor.html();
		$scope.$apply();
	});

	return positionning;
};

module.directive('richTextEditor', function($compile){
	return {
		restrict: 'E',
		scope: {
			ngModel: '=',
			watchCollection: '@',
			notify: '='
		},
		template: '<div class="twelve cell block-editor"><div contenteditable="true" class="editor-container twelve cell">' +
			'</div><div class="clear"></div></div>',
		compile: function($element, $attributes, $transclude){
			CKEDITOR_BASEPATH = '/infra/public/ckeditor/';
			if(window.CKEDITOR === undefined){
				loader.syncLoad('ckeditor');
				CKEDITOR.plugins.basePath = '/infra/public/ckeditor/plugins/';
			}
			return function($scope, $element, $attributes){
				var editor = $('[contenteditable=true]');
				CKEDITOR.inline(editor[0],
					{ customConfig: '/infra/public/ckeditor/rich-text-config.js' }
				);

				var positionning = createCKEditorInstance(editor, $scope, $compile);
				$scope.$eval($scope.watchCollection).forEach(function(col){
					$scope.$parent.$watchCollection(col, function(){
						positionning();
					});
				})

				$element.on('removed', function(){
					for(var instance in CKEDITOR.instances){
						CKEDITOR.instances[instance].destroy()
					}
					$('.cke').remove();
				})
			}
		}
	}
});

module.directive('textEditor', function($compile){
	return {
		restrict: 'E',
		scope: {
			ngModel: '=',
			watchCollection: '@',
			notify: '='
		},
		template: '<div contenteditable="true" style="width: 100%;" class="contextual-editor"></div>',
		compile: function($element, $attributes, $transclude){
			CKEDITOR_BASEPATH = '/infra/public/ckeditor/';
			if(window.CKEDITOR === undefined){
				loader.syncLoad('ckeditor');
				CKEDITOR.plugins.basePath = '/infra/public/ckeditor/plugins/';
			}
			return function($scope, $element, $attributes){
				var editor = $element.find('[contenteditable=true]');
				var instance = CKEDITOR.inline(editor[0],
					{ customConfig: '/infra/public/ckeditor/text-config.js' }
				);
				CKEDITOR.on('instanceReady', function(ck){
					editor.html($compile($scope.ngModel)($scope.$parent));
				});

				$scope.$watch('ngModel', function(newVal){
					if(newVal !== editor.html()){
						editor.html($compile($scope.ngModel)($scope.$parent));
					}
				});

				$element.on('click', function(){
					if(editor.parent().parent().data('resizing') || editor.parent().parent().data('dragging')){
						return;
					}
					editor.focus();
				});
				$element.parent().on('startDrag', function(){
					editor.blur();
				});
				editor.on('focus', function(){
					editor.parent().parent().height(editor.height());
					editor.parent().parent().trigger('stopResize');
					$('.' + instance.id).width(editor.width());
					editor.parent().parent().data('lock', true);
					editor.css({ 'cursor': 'text' });
					$(document).on('keyup.editor', function(key){
						editor.parent().parent().height(editor.height());
						editor.parent().parent().trigger('stopResize');
					});
				});
				editor.on('blur', function(){
					editor.parent().parent().data('lock', false);
					editor.css({ 'cursor': '' });
					$scope.ngModel = editor.html();
					$scope.$apply('ngModel');
					$(document).unbind('keyup.editor');
				})
				$element.on('removed', function(){
					for(var instance in CKEDITOR.instances){
						CKEDITOR.instances[instance].destroy()
					}
					$('.cke').remove();
				})
			}
		}
	}
})

module.directive('htmlEditor', function($compile){
	return {
		restrict: 'E',
		transclude: true,
		replace: true,
		scope: {
			ngModel: '=',
			notify: '='
		},
		template: '<div class="twelve cell block-editor"><div contenteditable="true" class="editor-container twelve cell" loading-panel="ckeditor-image">' +
			'</div><div class="clear"></div></div>',
		compile: function($element, $attributes, $transclude){
			CKEDITOR_BASEPATH = '/infra/public/ckeditor/';
			if(window.CKEDITOR === undefined){
				loader.syncLoad('ckeditor');
				CKEDITOR.plugins.basePath = '/infra/public/ckeditor/plugins/';

			}
			return function($scope, $element, $attributes){
				CKEDITOR.fileUploadPath = $scope.$eval($attributes.fileUploadPath);
				CKEDITOR.inlineAll();
				var editor = $('[contenteditable=true]');

				createCKEditorInstance(editor, $scope, $compile);

				$element.on('removed', function(){
					for(var instance in CKEDITOR.instances){
						CKEDITOR.instances[instance].destroy()
					}
					$('.cke').remove();
				})
			}
		}
	}
});

module.directive('loadingIcon', function($compile){
	return {
		restrict: 'E',
		link: function($scope, $element, $attributes){
			var addImage = function(){
				var loadingIllustrationPath = $('link').attr('href').split('/theme.css')[0] + '/../img/icons/anim_loading_small.gif';
				$('<img>')
					.attr('src', loadingIllustrationPath)
					.attr('class', $attributes.class)
					.addClass('loading-icon')
					.appendTo($element);
			}
			if($attributes.default=== 'loading'){
				addImage();
			}
			http().bind('request-started.' + $attributes.request, function(e){
				addImage();
			});

			http().bind('request-ended.' + $attributes.request, function(e){
				var loadingDonePath = $('link').attr('href').split('/theme.css')[0] + '/../img/icons/checkbox-checked.png';
				$element.find('.loading-icon').remove();
				$('<img>')
					.attr('src', loadingDonePath)
					.appendTo($element);
			});
		}
	}
})

module.directive('loadingPanel', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $element, $attributes){
			$attributes.$observe('loadingPanel', function(val) {
				http().bind('request-started.' + $attributes.loadingPanel, function(e){
					var loadingIllustrationPath = $('link').attr('href').split('/theme.css')[0] + '/../img/illustrations/loading.gif';
					$element.append('<div class="loading-panel">' +
						'<h1>' + lang.translate('loading') + '</h1>' +
						'<img src="' + loadingIllustrationPath + '" />' +
						'</div>');

				})
				http().bind('request-ended.' + $attributes.loadingPanel, function(e){
					$element.find('.loading-panel').remove();
				})
			});
		}
	}
});

module.directive('workflow', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $element, $attributes){
			var auth = $attributes.workflow.split('.');
			var right = model.me.workflow;
			auth.forEach(function(prop){
				right = right[prop];
			});
			var content = $element.children();
			if(!right){
				content.remove();
				$element.hide();
			}
			else{
				$element.show();
				$element.append(content);
			}
		}
	}
});

module.directive('tooltip', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $element, $attributes){
			$element.on('mouseover', function(){
				var tip = $('<div />')
					.addClass('tooltip')
					.html('<div class="arrow"></div><div class="content">' + lang.translate($attributes.tooltip) + '</div> ')
					.appendTo('body');;

				tip.offset({
					top: parseInt($element.offset().top + $element.height()),
					left: parseInt($element.offset().left + $element.width() / 2 - tip.width() / 2)
				});
				tip.fadeIn();
				$element.one('mouseout', function(){
					tip.fadeOut(200, function(){
						tip.remove();
					})
				});
			});

		}
	}
});

module.directive('behaviour', function($compile){
	return {
		restrict: 'E',
		template: '<div ng-transclude></div>',
		replace: false,
		transclude: true,
		scope: {
			resource: '='
		},
		link: function($scope, $element, $attributes){
			if(!$attributes.name){
				throw "Behaviour name is required";
			}
			var content = $element.children('div');
			$scope.$watch('resource', function(newVal){
				var hide = ($scope.resource instanceof Array && _.find($scope.resource, function(resource){ return !resource.myRights || resource.myRights[$attributes.name] === undefined; }) !== undefined) ||
					($scope.resource instanceof Model && (!$scope.resource.myRights || !$scope.resource.myRights[$attributes.name]));

				if(hide){
					content.remove();
				}
				else{
					$element.append(content);
				}

			});
		}
	}
});

module.directive('bottomScroll', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $element, $attributes){
			$(window).scroll(function(){
				var scrollHeight = window.scrollY || document.getElementsByTagName('html')[0].scrollTop;
				//adding ten pixels to account for system specific behaviours
				scrollHeight += 10;

				if($(document).height() - $(window).height() < scrollHeight){
					$scope.$eval($attributes.bottomScroll);
					if(!$scope.$$phase){
						$scope.$apply();
					}

				}
			})
		}
	}
});

module.directive('resizable', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $element, $attributes){
			$('body').css({
				'-webkit-user-select': 'none',
				'-moz-user-select': 'none',
				'user-select' : 'none'
			});

			//cursor styles to indicate resizing possibilities
			$element.on('mouseover', function(e){
				$element.on('mousemove', function(e){
					if($element.data('resizing') || $element.data('lock')){
						return;
					}
					var mouse = { x: e.pageX, y: e.pageY };
					var resizeLimits = {
						horizontalRight:  $element.offset().left + $element.width() + 5 > mouse.x && mouse.x > $element.offset().left + $element.width() - 15,
						horizontalLeft: $element.offset().left + 5 > mouse.x && mouse.x > $element.offset().left - 15,
						verticalTop: $element.offset().top + 5 > mouse.y && mouse.y > $element.offset().top - 15,
						verticalBottom: $element.offset().top + $element.height() + 5 > mouse.y && mouse.y > $element.offset().top + $element.height() - 15
					};

					var orientations = {
						'ns': resizeLimits.verticalTop || resizeLimits.verticalBottom,
						'ew': resizeLimits.horizontalLeft || resizeLimits.horizontalRight,
						'nwse': (resizeLimits.verticalBottom && resizeLimits.horizontalRight) || (resizeLimits.verticalTop && resizeLimits.horizontalLeft),
						'nesw': (resizeLimits.verticalBottom && resizeLimits.horizontalLeft) || (resizeLimits.verticalTop && resizeLimits.horizontalRight)

					};

					var cursor = '';
					for(var orientation in orientations){
						if(orientations[orientation]){
							cursor = orientation;
						}
					}


					if(cursor){
						cursor = cursor + '-resize';
					}
					$element.css({ cursor: cursor });
					$element.find('[contenteditable]').css({ cursor: cursor });
				});
				$element.on('mouseout', function(e){
					$element.unbind('mousemove');
				});
			});

			//actual resize
			$element.on('mousedown.resize', function(e){
				if($element.data('lock') === true || $element.data('resizing') === true){
					return;
				}
				$element.trigger('startResize');
				e.preventDefault();
				var interrupt = false;
				var mouse = { y: e.pageY, x: e.pageX };
				var resizeLimits = {
					horizontalRight:  $element.offset().left + $element.width() + 15 > mouse.x && mouse.x > $element.offset().left + $element.width() - 15,
					horizontalLeft: $element.offset().left + 15 > mouse.x && mouse.x > $element.offset().left - 15,
					verticalTop: $element.offset().top + 15 > mouse.y && mouse.y > $element.offset().top - 15,
					verticalBottom: $element.offset().top + $element.height() + 15 > mouse.y && mouse.y > $element.offset().top + $element.height() - 15
				};

				var initial = {
					pos: $element.offset(),
					size: {
						width: $element.width(),
						height: $element.height()
					}
				};
				var parent = $element.parents('.drawing-zone');
				var parentData = {
					pos: parent.offset(),
					size: {
						width: parent.width(),
						height: parent.height()
					}
				};

				if(resizeLimits.horizontalLeft || resizeLimits.horizontalRight ||resizeLimits.verticalTop || resizeLimits.verticalBottom){
					$element.data('resizing', true);
					$('.main').css({
						'cursor': $element.css('cursor')
					});
					$(window).unbind('mousemove.drag');
					$(window).on('mousemove.resize', function(e){
						$element.unbind("click");
						mouse = {
							y: e.pageY,
							x: e.pageX
						};
					});

					//animation for resizing
					var resize = function(){
						var newWidth = 0; var newHeight = 0;
						if(resizeLimits.horizontalLeft || resizeLimits.horizontalRight){
							var p = $element.offset();
							if(resizeLimits.horizontalLeft){
								var distance = initial.pos.left - mouse.x;
								if(initial.pos.left - distance < parentData.pos.left){
									distance = initial.pos.left - parentData.pos.left;
								}
								$element.offset({
									left: initial.pos.left - distance,
									top: p.top
								});
								newWidth = initial.size.width + distance;
							}
							else{
								var distance = mouse.x - p.left;
								if($element.offset().left + distance > parentData.pos.left + parentData.size.width){
									distance = (parentData.pos.left + parentData.size.width) - $element.offset().left - 2;
								}
								newWidth = distance;
							}
							if(newWidth > 0){
								$element.width(newWidth);
							}
						}
						if(resizeLimits.verticalTop || resizeLimits.verticalBottom){
							var p = $element.offset();
							if(resizeLimits.verticalTop){
								var distance = initial.pos.top - mouse.y;
								if(initial.pos.top - distance < parentData.pos.top){
									distance = initial.pos.top - parentData.pos.top;
								}
								$element.offset({
									left: p.left,
									top: initial.pos.top - distance
								});
								newHeight = initial.size.height + distance;
							}
							else{
								var distance = mouse.y - p.top;
								if($element.offset().top + distance > parentData.pos.top + parent.height()){
									distance = (parentData.pos.top + parentData.size.height) - $element.offset().top - 2;
								}
								newHeight = distance;
							}
							if(newHeight > 0){
								$element.height(newHeight);
							}
						}
						$element.trigger('resizing');
						if(!interrupt){
							requestAnimationFrame(resize);
						}
					};
					resize();

					$(window).on('mouseup.resize', function(){
						$element.trigger('stopResize');
						interrupt = true;
						setTimeout(function(){
							$element.data('resizing', false);
						}, 0)
						$(window).unbind('mousemove.resize');
						$('body').unbind('mouseup.resize');
						$('.main').css({'cursor': ''})
					});
				}
			});
		}
	}
});

module.directive('placedBlock', function($compile){
	return {
		restrict: 'E',
		replace: true,
		transclude: true,
		scope: {
			x: '=',
			y: '=',
			z: '=',
			h: '=',
			w: '='
		},
		template: '<article ng-transclude ng-style="{\'z-index\': z }"></article>',
		link: function($scope, $element, $attributes){
			$element.css({ 'position': 'absolute' });
			$scope.$watch('x', function(newVal){
				$element.offset({
					top: $element.offset().top,
					left: newVal + $element.parent().offset().left
				});
			});

			$scope.$watch('y', function(newVal){
				$element.offset({
					left: $element.offset().left,
					top: newVal + $element.parent().offset().top
				});
			});

			var toTop = function(){
				$(':focus').blur();
				$element.parents('.drawing-zone').find('*').each(function(index, item){
					var zIndex = $(item).css('z-index');
					if(!$scope.z){
						$scope.z = 1;
					}
					if(parseInt(zIndex) && parseInt(zIndex) >= $scope.z){
						$scope.z = parseInt(zIndex) + 1;
					}
				});
				$scope.$apply('z');
			};

			$element.on('startDrag', toTop);
			$element.on('startResize', function(){
				$scope.w = $element.width();
				$scope.$apply('w');
				$scope.h = $element.height();
				$scope.$apply('h');
				toTop();
			});

			$element.on('stopDrag', function(){
				$scope.x = $element.position().left;
				$scope.$apply('x');
				$scope.y = $element.position().top;
				$scope.$apply('y');
			});

			$scope.$watch('z', function(newVal){
				$element.css({ 'z-index': $scope.z })
			});

			$scope.$watch('w', function(newVal){
				$element.width(newVal);
			});
			$element.on('stopResize', function(){
				$scope.w = $element.width();
				$scope.$apply('w');
				$scope.h = $element.height();
				$scope.$apply('h');
			});

			$scope.$watch('h', function(newVal){
				$element.height(newVal);
			});
		}
	}
});

module.directive('draggable', function($compile){
	return {
		restrict: 'A',
		link: function($scope, $element, $attributes){
			$element.on('mousedown', function(e){
				if($element.data('lock') === true){
					return;
				}
				e.preventDefault();
				var interrupt = false;
				if($element.data('resizing') !== true){
					$element.trigger('startDrag');

					$('body').css({
						'-webkit-user-select': 'none',
						'-moz-user-select': 'none',
						'user-select' : 'none'
					});
					$element.css({
						'position': 'absolute'
					});
					var mouse = { y: e.clientY, x: e.clientX };
					var elementDistance = {
						y: mouse.y - $element.offset().top,
						x: mouse.x - $element.offset().left
					};
					$(window).on('mousemove.drag', function(e){
						$element.unbind("click");
						$element.data('dragging', true)
						mouse = {
							y: e.clientY,
							x: e.clientX
						};
					});

					$('body').on('mouseup.drag', function(e){
						$element.trigger('stopDrag');
						$('body').css({
							'-webkit-user-select': 'initial',
							'-moz-user-select': 'initial',
							'user-select' : 'initial'
						});
						interrupt = true;
						$('body').unbind('mouseup.drag');
						$(window).unbind('mousemove.drag');
						setTimeout(function(){
							$element.data('dragging', false);
							$element.on('click', function(){
								$scope.$parent.$eval($attributes.ngClick);
							});
						}, 0);
					});
					var moveElement = function(){
						var parent = $('article').parents('.drawing-zone');
						var parentPosition = parent.offset();
						var boundaries = {
							left: parentPosition.left,
							top: parentPosition.top,
							right: parentPosition.left + parent.width() - $element.width(),
							bottom: parentPosition.top + parent.height() - $element.height()
						}

						var newOffset = {
							top: mouse.y - elementDistance.y,
							left: mouse.x - elementDistance.x
						};

						if(mouse.x < boundaries.left + elementDistance.x && $element.width() < parent.width()){
							newOffset.left = boundaries.left;
						}
						if(mouse.x > boundaries.right + elementDistance.x && $element.width() < parent.width()){
							newOffset.left = boundaries.right - 2
						}
						if(mouse.y < boundaries.top + elementDistance.y && $element.height() < parent.height()){
							newOffset.top = boundaries.top;
						}
						if(mouse.y > boundaries.bottom + elementDistance.y && $element.height() < parent.height()){
							newOffset.top = boundaries.bottom - 2;
						}

						$element.offset(newOffset);

						if(!interrupt){
							requestAnimationFrame(moveElement);
						}
					};
					moveElement();
				}
			});
		}
	}
});

module.directive('sharePanel', function($compile){
	return {
		scope: {
			resources: '=',
			appPrefix: '='
		},
		restrict: 'E',
		templateUrl: '/infra/public/template/share-panel.html',
		link: function($scope, $element, $attributes){

		}
	}
});

module.directive('datePicker', function($compile){
	return {
		scope: {
			ngModel: '=',
			ngChange: '&'
		},
		transclude: true,
		replace: true,
		restrict: 'E',
		template: '<input ng-transclude type="text" data-date-format="dd/mm/yyyy"  />',
		link: function($scope, $element, $attributes){
			$scope.$watch('ngModel', function(newVal){
				$element.val(moment($scope.ngModel).format('DD/MM/YYYY'));
			});
			loader.asyncLoad('/infra/public/js/bootstrap-datepicker.js', function(){
				$element.datepicker({
						dates: {
							months: moment.months(),
							monthsShort: moment.monthsShort(),
							days: moment.weekdays(),
							daysShort: moment.weekdaysShort(),
							daysMin: moment.weekdaysMin()
						}
					})
					.on('changeDate', function(){
						setTimeout(function(){
							var date = $element.val().split('/');
							var temp = date[0];
							date[0] = date[1];
							date[1] = temp;
							date = date.join('/');
							$scope.ngModel = new Date(date);
							$scope.$apply('ngModel');
							$scope.$parent.$eval($scope.ngChange);
							$scope.$parent.$apply();
						}, 10);

						$(this).datepicker('hide');
					});
				$element.datepicker('hide');
			});

			$element.on('focus', function(){
				var that = this;
				$(this).parents('form').on('submit', function(){
					$(that).datepicker('hide');
				});
				$element.datepicker('show');
			});

		}
	}
})

$(document).ready(function(){

	bootstrap(function(){
		model.build();
		model.sync();
		angular.bootstrap($('html'), ['app']);
	});
});


function Account($scope){
	"use strict";

	$scope.nbNewMessages = 0;
	$scope.me = model.me;

	$scope.refreshAvatar = function(){
		http().get('/userbook/api/person').done(function(result){
			$scope.avatar = result.result['0'].photo;
			$scope.username = result.result['0'].displayName;
			$scope.$apply();
		});
	};

	http().get('/conversation/count/INBOX', { unread: true }).done(function(nbMessages){
		$scope.nbNewMessages = nbMessages.count;
		$scope.$apply('nbNewMessages');
	});

	$scope.refreshAvatar();
}

function Share($rootScope, $scope, ui, _, lang){
	if(!$scope.appPrefix){
		$scope.appPrefix = appPrefix;
	}
	$scope.sharing = {};
	$scope.found = [];
	$scope.maxResults = 5;

	$scope.editResources = [];
	$scope.sharingModel = {
		edited: []
	};

	$scope.addResults = function(){
		$scope.maxResults += 5;
	};

	var actionsConfiguration = {};

	http().get('/infra/public/json/sharing-rights.json').done(function(config){
		actionsConfiguration = config;
	});

	$scope.translate = lang.translate;

	function actionToRights(item, action){
		var actions = [];
		_.where($scope.actions, { displayName: action.displayName }).forEach(function(item){
			item.name.forEach(function(i){
				actions.push(i);
			});
		});

		return actions;
	}

	function rightsToActions(rights, http){
		var actions = {};

		rights.forEach(function(right){
			var action = _.find($scope.actions, function(action){
				return action.name.indexOf(right) !== -1
			});

			if(!actions[action.displayName]){
				actions[action.displayName] = true;
			}
		});

		return actions;
	}

	function setActions(actions){
		$scope.actions = actions;
		$scope.actions.forEach(function(action){
			var actionId = action.displayName.split('.')[1];
			if(actionsConfiguration[actionId]){
				action.priority = actionsConfiguration[actionId].priority;
				action.requires = actionsConfiguration[actionId].requires;
			}
		});
	}

	function dropRights(callback){
		function drop(resource, type){
			var done = 0;
			for(var element in resource[type].checked){
				var path = '/' + $scope.appPrefix + '/share/remove/' + resource._id;
				var data = {};
				if(type === 'users'){
					data.userId = element;
				}
				else{
					data.groupId = element;
				}
				http().put(path, http().serialize(data));
			}
		}
		$scope.editResources.forEach(function(resource){
			drop(resource, 'users');
			drop(resource, 'groups');
		});
		callback();
		$scope.varyingRights = false;
	}

	function differentRights(model1, model2){
		var result = false;
		function different(type){
			for(var element in model1[type].checked){
				if(!model2[type].checked[element]){
					return true;
				}

				model1[type].checked[element].forEach(function(right){
					result = result || model2[type].checked[element].indexOf(right) === -1
				});
			}

			return result;
		}

		return different('users') || different('groups');
	}

	var feedData = function(){
		var initModel = true;
		$scope.resources.forEach(function(resource){
			var id = resource._id;
			http().get('/' + $scope.appPrefix + '/share/json/' + id).done(function(data){
				if(initModel){
					$scope.sharingModel = data;
					$scope.sharingModel.edited = [];
				}

				data._id = resource._id;
				$scope.editResources.push(data);
				var editResource = $scope.editResources[$scope.editResources.length -1];
				if(!$scope.sharing.actions){
					setActions(data.actions);
				}

				function addToEdit(type){
					for(var element in editResource[type].checked){
						var rights = editResource[type].checked[element];

						var groupActions = rightsToActions(rights);
						var elementObj = _.findWhere(editResource[type].visibles, {
							id: element
						});
						elementObj.actions = groupActions;
						if(initModel){
							$scope.sharingModel.edited.push(elementObj);
						}

						elementObj.index = $scope.sharingModel.edited.length;
					}
				}

				addToEdit('groups');
				addToEdit('users');

				if(!initModel){
					if(differentRights(editResource, $scope.sharingModel) || differentRights($scope.sharingModel, editResource)){
						$scope.varyingRights = true;
						$scope.sharingModel.edited = [];
					}
				}
				initModel = false;

				$scope.$apply('sharingModel.edited');
			});
		})
	};

	$scope.$watch('resources', function(){
		$scope.actions = [];
		$scope.sharingModel.edited = [];
		$scope.search = '';
		$scope.found = [];
		$scope.varyingRights = false;
		feedData();
	})

	$scope.addEdit = function(item){
		item.actions = {};
		$scope.sharingModel.edited.push(item);
		item.index = $scope.sharingModel.edited.length;
		$scope.found = [];
		$scope.search = '';

		$scope.actions.forEach(function(action){
			var actionId = action.displayName.split('.')[1];
			if(actionsConfiguration[actionId].default){
				item.actions[action.displayName] = true;
				$scope.saveRights(item, action);
			}
		});
	};

	$scope.findUserOrGroup = function(){
		var searchTerm = lang.removeAccents($scope.search).toLowerCase();
		$scope.found = _.union(
			_.filter($scope.sharingModel.groups.visibles, function(group){
				var testName = lang.removeAccents(group.name).toLowerCase();
				return testName.indexOf(searchTerm) !== -1;
			}),
			_.filter($scope.sharingModel.users.visibles, function(user){
				var testName = lang.removeAccents(user.lastName + ' ' + user.firstName).toLowerCase();
				var testNameReversed = lang.removeAccents(user.firstName + ' ' + user.lastName).toLowerCase();
				return testName.indexOf(searchTerm) !== -1 || testNameReversed.indexOf(searchTerm) !== -1;
			})
		);
		$scope.found = _.filter($scope.found, function(element){
			return $scope.sharingModel.edited.indexOf(element) === -1;
		})
	};

	$scope.remove = function(element){
		var data;
		if(element.login !== undefined){
			data = {
				userId: element.id
			}
		}
		else{
			data = {
				groupId: element.id
			}
		}

		$scope.sharingModel.edited = _.reject($scope.sharingModel.edited, function(item){
			return item.id === element.id;
		});

		$scope.resources.forEach(function(resource){
			var path = '/' + $scope.appPrefix + '/share/remove/' + resource._id;
			http().put(path, http().serialize(data)).done(function(){
				$rootScope.$broadcast('share-updated');
			});
		})
	}

	$scope.maxEdit = 5;

	$scope.displayMore = function(){
		var displayMoreInc = 5;
		$scope.maxEdit += displayMoreInc;
	}

	function applyRights(element, action){
		var data;
		if(element.login !== undefined){
			data = { userId: element.id }
		}
		else{
			data = { groupId: element.id }
		}
		data.actions = actionToRights(element, action);

		var setPath = 'json';
		if(!element.actions[action.displayName]){
			setPath = 'remove';
			_.filter($scope.actions, function(item){
				return _.find(item.requires, function(dependency){
					return action.displayName.indexOf(dependency) !== -1;
				}) !== undefined
			})
				.forEach(function(item){
					element.actions[item.displayName] = false;
					data.actions = data.actions.concat(actionToRights(element, item));
				})
		}
		else{
			action.requires.forEach(function(required){
				var action = _.find($scope.actions, function(action){
					return action.displayName.indexOf(required) !== -1;
				});
				element.actions[action.displayName] = true;
				data.actions = data.actions.concat(actionToRights(element, action));
			});
		}

		$scope.resources.forEach(function(resource){
			http().put('/' + $scope.appPrefix + '/share/' + setPath + '/' + resource._id, http().serialize(data)).done(function(){
				$rootScope.$broadcast('share-updated');
			});
		});
	}

	$scope.saveRights = function(element, action){
		if($scope.varyingRights){
			dropRights(function(){
				applyRights(element, action)
			});
		}
		else{
			applyRights(element, action);
		}
	};
}

function Admin($scope){
	$scope.urls = [];
	http().get('/admin-urls').done(function(urls){
		$scope.urls = urls;
		$scope.$apply('urls');
	});

	$scope.scrollUp = ui.scrollToTop;
}
