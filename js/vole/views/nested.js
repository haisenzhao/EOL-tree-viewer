(function () {
	var viewContainer = jQuery("<div class='vole-view-nested'>"),
		
		view = {
			name: 'nested',
			getContainer: function() {
				return viewContainer;
			},
			show: function (tree, templateHelper) {
				var view = jQuery.tmpl('nested.tree', tree, templateHelper);
	
				//mark the data item with its view depth, so children can tell how deep they are
				view.find("div.node.root").tmplItem().data.voleDepth = 0;
				
				viewContainer.empty().append(view);
	
				vole.getLayout().doLayout(view[0], getNodeOps(), true);
				
				fetchChildren(view, templateHelper, vole.getViewDepth());
	
				fetchLeafImages(view, templateHelper);
			},
			resize: function () {
				var root = jQuery("div.node.root");
				vole.getLayout().doLayout(root, getNodeOps(), true);
				
				//if the root is also a leaf, resize its image
				var image = root.children("div.body").children("img.resizable")[0];
				if (image) {
					image.resizeToFill();
				}
			},
			layoutOps: {
				setBounds: function setBounds(node, bounds) {
					bounds = {
						x:Math.round(bounds.x),
						y:Math.round(bounds.y),
						width:Math.round(bounds.width),
						height:Math.round(bounds.height)
					}
					var borderWidth = 1,
					image = {};
					//TODO check actual border width once at startup
					
					node = jQuery(node);
					node.css({'left':bounds.x, 'top':bounds.y});
					node.height(bounds.height - 2 * borderWidth);
					node.width(bounds.width - 2 * borderWidth);
	
					//if body contents is an image (i.e. node is displayed as a leaf) resize the image
					image = node.children("div.body").children("img.resizable")[0];
					if (image) {
						image.resizeToFill();
					}
				},
			
				/* takes a DOM div.node and returns its div.node children (not the 
				 * immediate DOM children, which would just be the header and body 
				 * container) 
				 */
				getLayoutChildren: function getLayoutChildren(node) {
					var childContainer = jQuery(node).children("div.body").first();
					return jQuery.makeArray(childContainer.children("div.node"));
				},
			
				/* takes a DOM div.node and returns the bounds of its child container */
				getLayoutBounds: function getLayoutBounds(node) {
					var childContainer = jQuery(node).children("div.body").first();
					return {
						x: 0,
						y: 0,
						width: childContainer.width(),
						height: childContainer.height()
					};
				}
			}
		};

	function compileTemplates() {
		jQuery.template("nested.tree", "<div>{{tmpl($item.getRoot(), $item.helper) 'nested.root'}}</div>");
		
		jQuery.template("nested.root", 
			"<div class='node selectable root'>"+
				"{{tmpl($item.data, $item.helper) 'nested.breadcrumb'}}"+
				"{{tmpl($item.data, $item.helper) 'nested.body'}}"+
			"</div>");
		
		jQuery.template("nested.node", 
			"{{if $item.displayableNode()}}"+
				"<div class='node selectable'>"+
					"{{tmpl($item.data, $item.helper) 'nested.head'}}"+
					"{{tmpl($item.data, $item.helper) 'nested.body'}}"+
				"</div>"+
			"{{/if}}");
		
		jQuery.template("nested.head", "<div class='head'><span>${$item.getName()}</span></div>");
		
		jQuery.template("nested.body", 
			"{{if $item.hasChildren()}}"+
				"<div class='body children to-fetch'></div>"+
			"{{else}}"+
				"<div class='body leaf to-fetch'></div>"+
			"{{/if}}");
		
		jQuery.template("nested.breadcrumb", 
			"<div class='head'>"+
				"<span class='breadcrumbs'>"+
					"<span class='breadcrumb current'>${$item.getName()}</span>"+
		
					"<span class='breadcrumb ancestors'>"+
						"{{tmpl($item.getAncestors(), $item.helper) 'nested.breadcrumbAncestor'}}"+
					"</span>"+
				"</span>"+
			"</div>");
		
		jQuery.template("nested.breadcrumbAncestor", "${' < '}<a class='breadcrumb ancestor'>${$item.getName()}</a>");
	}
	
	/**
	 * container: some node div to fetch children within
	 * templateHelper: the tree source
	 */
	function fetchChildren(container, templateHelper, maxDepth) {
		container.find("div.body.children.to-fetch").each(function(){
			var parentBody = jQuery(this),
				tmplItem = parentBody.tmplItem(),
				parentDepth = tmplItem.data.voleDepth,
				parentNode = parentBody.parent()[0],
				parentName = tmplItem.getName();

			//display children if there is space or if the parent is unnamed 
			if (!parentName || parentDepth < maxDepth && parentBody.width() > 50 && parentBody.height() > 50) {
				parentBody.addClass("async-wait");
				tmplItem.getChildrenAsync().done(function (children) {
					jQuery.each(children, function(index, child) {
						child.voleDepth = parentDepth + 1;
					});
					
					var childNodes = jQuery.tmpl('nested.node', children, templateHelper);  
					
					parentBody.empty().append(childNodes);
					
					vole.getLayout().doLayout(parentNode, getNodeOps(), true);

					parentBody.removeClass("to-fetch async-wait");

					//these both basically happen asynchronously: any node bodies marked "leaf to-fetch" will get images and any "children to-fetch" will get children
					fetchLeafImages(parentNode, templateHelper);
					fetchChildren(parentBody, templateHelper, vole.getViewDepth());
				});
			} else {
				parentBody.removeClass("children");
				parentBody.addClass("leaf to-fetch");
				fetchLeafImages(parentNode, templateHelper);
			}
			
			parentBody.removeClass("to-fetch");
		});
	}

	function fetchLeafImages(container, templateHelper) {
		jQuery(container).find("div.body.leaf.to-fetch").each(function(){
			var leafBody = jQuery(this),
				thumbnail = leafBody.width() < 150 && leafBody.height() < 150;
				tmplItem = leafBody.tmplItem(),
				image = tmplItem.getImage(thumbnail);

			leafBody.empty().append(image);
			
			jQuery(image).load(function() {
				//assuming no scaling has been done yet, setting 'natural' dims for browsers that don't set them
				this.naturalWidth = this.naturalWidth || this.width;
				this.naturalHeight = this.naturalHeight || this.height;
	
				if (jQuery(this).hasClass("resizable")) {
					this.resizeToFill();
				}
			});

			leafBody.removeClass("to-fetch");
		});
	}

	function getNodeOps() {
		return jQuery.extend({}, vole.getAreaModel(), view.layoutOps);
	}

	//TODO add methods to setup and tear down the event handlers
	jQuery("div.node, a.breadcrumb.ancestor").live("click", function() {
		var tmplItem = jQuery(this).tmplItem(),
			url = tmplItem.getURL();

		if (url) {
			vole.view(url); 
		} else {
			//TODO try just showing the node before getting the URL?  vole won't trigger a view change event if I do
			view.show(tmplItem.data, tmplItem.helper);
		}
		return false; //only innermost node handles event
	});

	//TODO change this to a plain old function in the closure of setBounds?
	HTMLImageElement.prototype.resizeToFill = function resizeToFill() {
		var container = this.parentNode,
			imageAR = this.naturalWidth / this.naturalHeight,
			containerAR = container.clientWidth / container.clientHeight,
			overlapPercent,
			style = this.style;

		if (imageAR >= containerAR) {
			overlapPercent = 50 * (imageAR / containerAR - 1);

			//image aspect ratio is wider than container: fit height and center overlapping width
			style.top = "auto";
			style.height = "100%";
			style.width = "auto";
			style.left = -overlapPercent + "%";
		} else {
			overlapPercent = 50 * (containerAR / imageAR - 1);

			//image aspect ratio is taller than container: fit width and center overlapping height
			style.left ="auto";
			style.width = "100%";
			style.height = "auto";
			style.top = -overlapPercent + "%";
		}
	};
	
	compileTemplates();
	vole.addView(view.name, view);
})();
