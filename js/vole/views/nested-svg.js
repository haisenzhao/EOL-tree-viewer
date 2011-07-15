(function () {
	var viewContainer = jQuery("<div class='vole-view-nested-svg'>"),
		
		view = {
			name: 'nested-svg',
			getContainer: function() {
				return viewContainer;
			},
			show: function (tree, templateHelper) {
				var view = jQuery.tmpl('nested-svg.tree', tree, templateHelper);
				
				viewContainer.empty().append(view);
				
				//mark the data item with its view depth, so children can tell how deep they are
				getRootElement().tmplItem().data.voleDepth = 0;
	
				vole.getLayout().doLayout(view[0], getNodeOps(), true);
				
				fetchDescendants(view, templateHelper, vole.getViewDepth(), this.layoutOps);
	
				fetchLeafImages(view, templateHelper);
			},
			resize: function () {
				var root = viewContainer.children("svg");
				vole.getLayout().doLayout(root[0], getNodeOps(), true);
			},
			layoutOps: {
				/*
				 * takes a <g class='node'> sets it to the given bounds
				 */
				setBounds: function setBounds(node, bounds) {
					var node = jQuery(node),
						border;
					
					node.attr('transform', "translate(" + bounds.x + "," + bounds.y + ")");
					bounds.x = bounds.y = 0;
					
					//UGH, both the jQuery class selector and the attribute contains selector are currently broken for SVG: http://stackoverflow.com/questions/3294553/jquery-selector-svg-incompatible/5759456#5759456
					//border = jQuery(node).children("rect.node"); //broken
					//border = jQuery('rect[class~="node"]', node); //broken
					border = node.children().filter(function() {return this.className.baseVal.indexOf("node") > -1});
					
					border.attr(bounds);
				},
			
				/*
				 * takes either the root <svg> element, or a <g class='node'> and returns its child g.nodes
				 */
				getLayoutChildren: function getLayoutChildren(node) {
					var childContainer,
						children;
					
					if (node.tagName.toLowerCase() === "svg") {
						childContainer = jQuery(node);
					} else {
						//childContainer = jQuery(node).children("g.body").first();
						childContainer = jQuery(node).children("g").filter(function() {return this.className.baseVal.indexOf("body") > -1}); //jquery class selector is broken in svg
					}
					
					children = jQuery(childContainer).children("g").filter(function() {
						return this.className.baseVal.indexOf("node") > -1
					});
					return jQuery.makeArray(children); //jquery class selector is broken in svg
				},
			
				/* takes either the root <svg> element, or a <g class='node'> and returns the area in which its child nodes can be laid out */
				getLayoutBounds: function getLayoutBounds(node) {
					var container;
					
					if (node.tagName.toLowerCase() === "svg") {
						container = jQuery(node);
						return {
							x: 0,
							y: 0,
							width: container.width(),
							height: container.height()
						};
					} else {
						container = jQuery(node).children("rect").filter(function() {return this.className.baseVal.indexOf("node") > -1}); //jquery class selector is broken in svg
						return {
							x: 0,
							y: 0,
							width: container.attr('width'),
							height: container.attr('height') - 20
						};
					}
				}
			}
		};

	function compileTemplates() {
		jQuery.template("nested-svg.tree", "<svg>{{tmpl($item.getRoot(), $item.helper) 'nested-svg.root'}}</svg>");
		
		jQuery.template("nested-svg.root", 
			"<g class='node selectable root' transform='translate(0.5, 0.5)'>"+ //move half-pixel so the borders are not cropped off.  also, draws sharper, non-antialiased lines
				"<rect class='node selectable root' rx='10' ry='10' vector-effect='non-scaling-stroke' />"+ //TODO: set a vole.borderRadius (since we can't use css for this in svg)
				"{{tmpl($item.data, $item.helper) 'nested-svg.breadcrumb'}}"+
				"{{tmpl($item.data, $item.helper) 'nested-svg.body'}}"+
			"</g>");
		
		jQuery.template("nested-svg.node", 
			"{{if $item.displayableNode()}}"+
				"<svg:g class='node selectable' transform='translate(0, 0)'>"+	
					"{{tmpl($item.data, $item.helper) 'nested-svg.node-clip'}}"+
					"<rect class='node selectable' x='0' y='0' rx='10' ry='10' vector-effect='non-scaling-stroke' />"+
					"{{tmpl($item.data, $item.helper) 'nested-svg.head'}}"+
					"{{tmpl($item.data, $item.helper) 'nested-svg.body'}}"+
				"</svg:g>"+
			"{{/if}}");
		
		jQuery.template("nested-svg.node-clip",
			"<clipPath id='${$item.getID()}'>" +
				"<rect class='node selectable' x='0' y='0' rx='10' ry='10'/>"+
			"</clipPath>");
		
		jQuery.template("nested-svg.head", "<g class='head' transform='translate(0, 16)'><text>${$item.getName()}</text></g>");  //TODO: get current font size, or set a vole.fontSize and make the other views use it.  Also set the text margin in this translate.  Need another global...
		
		jQuery.template("nested-svg.body", 
			"{{if $item.hasChildren()}}"+
				"<g class='body children to-fetch' transform='translate(0, 20)'></g>" + //TODO: set a vole.headHeight (since we can't use css for this in svg) 
			"{{else}}"+
				"<g class='body leaf to-fetch' transform='translate(0, 20)'></g>"+
			"{{/if}}");
		
		jQuery.template("nested-svg.breadcrumb", 
			"<g class='head' transform='translate(0, 16)'>"+  //TODO: get current font size, or set a vole.fontSize and make the other views use it.  Also set the text margin in this translate.  Need another global...
				"<text class='breadcrumbs'>"+
					"<tspan class='breadcrumb current'>${$item.getName()}</tspan>"+
		
					"<tspan class='breadcrumb ancestors'>"+
						"{{tmpl($item.getAncestors(), $item.helper) 'nested-svg.breadcrumbAncestor'}}"+
					"</tspan>"+
				"</text>"+
			"</g>");
		
		jQuery.template("nested-svg.breadcrumbAncestor", "${' < '}<a class='breadcrumb ancestor'>${$item.getName()}</a>");
	}
	
	/**
	 * container: some node div to fetch children within
	 * templateHelper: the tree source
	 */
	function fetchDescendants(container, templateHelper, maxDepth, layoutOps) {
		container.find("g.body.children.to-fetch").each(function(){
			fetchChildren(this, templateHelper, maxDepth, layoutOps);
		});
	}
	
	function fetchChildren(parentBody, templateHelper, maxDepth, layoutOps) {
		var parentBody = jQuery(parentBody),
			tmplItem = parentBody.tmplItem(),
			parentDepth = tmplItem.data.voleDepth,
			parentNode = parentBody.parent()[0],
			parentName = tmplItem.getName(),
			layoutBounds = layoutOps.getLayoutBounds(parentNode);

		//display children if there is space or if the parent is unnamed 
		if (!parentName || parentDepth < maxDepth && layoutBounds.width > 50 && layoutBounds.height > 50) {
			parentBody.addClass("async-wait");
			tmplItem.getChildrenAsync().done(function (children) {
				jQuery.each(children, function(index, child) {
					child.voleDepth = parentDepth + 1;
				});
				
				var childNodes = jQuery.tmpl('nested-svg.node', children, templateHelper);
				
				parentBody.empty().append(childNodes);
				
				vole.getLayout().doLayout(parentNode, getNodeOps(), true);
	
				parentBody.removeClass("to-fetch async-wait");
	
				//these both basically happen asynchronously: any node bodies marked "leaf to-fetch" will get images and any "children to-fetch" will get children
				fetchLeafImages(parentNode, templateHelper);
				fetchDescendants(parentBody, templateHelper, vole.getViewDepth(), layoutOps);
			});
		} else {
			parentBody.removeClass("children");
			parentBody.addClass("leaf to-fetch");
			fetchLeafImages(parentNode, templateHelper);
		}
		
		parentBody.removeClass("to-fetch");
	}

	function fetchLeafImages(container, templateHelper) {
//		jQuery(container).find("div.body.leaf.to-fetch").each(function(){
//			var leafBody = jQuery(this),
//				thumbnail = leafBody.width() < 150 && leafBody.height() < 150;
//				tmplItem = leafBody.tmplItem(),
//				image = tmplItem.getImage(thumbnail);
//
//			leafBody.empty().append(image);
//			
//			jQuery(image).load(function() {
//				//assuming no scaling has been done yet, setting 'natural' dims for browsers that don't set them
//				this.naturalWidth = this.naturalWidth || this.width;
//				this.naturalHeight = this.naturalHeight || this.height;
//	
//				if (jQuery(this).hasClass("resizable")) {
//					this.resizeToFill();
//				}
//			});
//
//			leafBody.removeClass("to-fetch");
//		});
	}

	function getNodeOps() {
		return jQuery.extend({}, vole.getAreaModel(), view.layoutOps);
	}
	
	function getRootElement() {
		return jQuery("g.node.root", viewContainer);
	}

	//TODO add methods to setup and tear down the event handlers
//	jQuery("div.node, a.breadcrumb.ancestor").live("click", function() {
//		var tmplItem = jQuery(this).tmplItem(),
//			url = tmplItem.getURL();
//
//		if (url) {
//			vole.view(url); 
//		} else {
//			//TODO try just showing the node before getting the URL?  vole won't trigger a view change event if I do
//			view.show(tmplItem.data, tmplItem.helper);
//		}
//		return false; //only innermost node handles event
//	});
	
	compileTemplates();
	vole.addView(view.name, view);
})();
