(function () {
	var viewContainer = jQuery("<div class='vole-view-nested-svg'>"),
		headHeight = 20,
		headFontSize = 16,
		borderRadius = 10,
		minScale = 0.5,
		maxScale = 4,
		
		view = {
			name: 'nested-svg',
			getContainer: function() {
				return viewContainer;
			},
			show: function (tree, templateAdapter) {
				var svg = $(".vole-view-nested-svg").svg('get'),
					view;
				
				//firefox svg element doesn't seem to obey the 100% dims, so we'll just make sure it's sized now
				jQuery(svg.root()).width(jQuery(svg.root()).parent().width());
				jQuery(svg.root()).height(jQuery(svg.root()).parent().height());
				
				svg.clear();
				view = node(svg, svg.group({"class": "scene"}), tree, templateAdapter);
				
				//mark the data item with its view depth, so children can tell how deep they are
				jQuery(view).data('depth', 0);
	
				vole.getLayout().doLayout(svg.root(), getNodeOps(), true);
				
				fetchDescendants(jQuery(view), templateAdapter, vole.getViewDepth(), this.layoutOps);
	
				fetchLeafImages(jQuery(view), templateAdapter);
			},
			resize: function () {
//				var root = viewContainer.children("svg");
//				vole.getLayout().doLayout(root[0], getNodeOps(), true);
				//TODO resize the svg element for firefox (which doesn't obey the 100% dims)
			},
			layoutOps: {
				/*
				 * takes a <g class='node'> sets it to the given bounds
				 */
				setBounds: function setBounds(node, bounds) {
					var viewport = node.nearestViewportElement,
						node = jQuery(node),
						border, body, clip,
						sx, sy,
						scale;
					
					node.attr('transform', "translate(" + bounds.x + "," + bounds.y + ")");
					bounds.x = bounds.y = 0;
					
					border = jQuery(node).children("rect.node");
					border.attr(bounds);
					
					clip = jQuery(node).children("clipPath").children("rect");
					clip.attr(bounds);
					
					//scale down the body so that, when the node is zoomed to full screen, text in children is normally sized
					sx = bounds.width / jQuery(viewport).width();
					sy = bounds.height / jQuery(viewport).height();
					scale = Math.max(sx, sy);
					
					body = jQuery(node).children("g.body");
					body.attr('transform', "translate(0, " + headHeight + ") scale(" + scale + ")");
				},
			
				/*
				 * takes either the root <svg> element, or a <g class='node'> and returns its child g.nodes
				 */
				getLayoutChildren: function getLayoutChildren(node) {
					var childContainer,
						children;
					
					if (node.tagName.toLowerCase() === "svg") {
						childContainer = jQuery(node).children("g.scene").first();
					} else {
						childContainer = jQuery(node).children("g.body").first();
					}
					
					return jQuery.makeArray(childContainer.children("g.node"));
				},
			
				/* takes either the root <svg> element, or a <g class='node'> and returns the area in which its child nodes can be laid out */
				getLayoutBounds: function getLayoutBounds(node) {
					var container, matrix;
					
					if (node.tagName.toLowerCase() === "svg") {
						container = jQuery(node);
						return {
							x: 0,
							y: 0,
							width: container.width(),
							height: container.height()
						};
					} else {
						container = jQuery(node).children("g.body");
						matrix = node.getTransformToElement(container[0]);
						
						return {
							x: 0,
							y: 0,
							width: matrix.a * node.getBBox().width,
							height: matrix.d * (node.getBBox().height - 20)
						};
					}
				}
			}
		};
	
	/* ********************
	 * Template functions *
	 **********************/
	//TODO make all of these more jQuery-ish.  Should just be able to create the elements and return them, and let the caller add them to the DOM where they want (remove svg and parent params).  May have to modify jquery.svg plugin.
	//TODO in the end, the only param should really be the node itself
	function node(svg, container, data, templateAdapter) {
		var g = svg.group(container, {"class": "node selectable", "transform": "translate(0, 0)", "clip-path": "url(#clip" + templateAdapter.getID(data) + ")"}),
			parent;

		border(svg, g, data, templateAdapter);
		clip(svg, g, data, templateAdapter);
		head(svg, g, data, templateAdapter);
		body(svg, g);

		jQuery(g).data({
			"node": data,
			"templateAdapter": templateAdapter
		});
		
		return g;
	}
	
	function border(svg, container, data, templateAdapter) {
		return svg.rect(container, 0, 0, 0, 0, borderRadius, borderRadius, {"class":"node selectable", "id":"border" + templateAdapter.getID(data)});
	}
	
	function clip(svg, container, data, templateAdapter) {
		var clipPath = svg.other(container, "clipPath", {id:"clip" + templateAdapter.getID(data)});
//		svg.use(clipPath, "#border" + templateAdapter.getID(data));
		svg.rect(clipPath, 0, 0, 0, 0);
		
		return clipPath;
	}
	
	function head(svg, container, data, templateAdapter) {
		return svg.text(container, 0, headFontSize, templateAdapter.getName(data));
	}

	function body(svg, container) {
		return svg.group(container, {"class":"body children-to-fetch", "transform": "translate(0, " + headHeight + ")"});
	}

	/* **********
	 * Updaters *
	 ************/
	
	/**
	 * container: some node div to fetch children within
	 * templateHelper: the tree source
	 */
	function fetchDescendants(container, templateHelper, maxDepth, layoutOps) {
		container.find("g.body.children-to-fetch").each(function(){
			fetchChildren(this, templateHelper, maxDepth, layoutOps);
		});
	}
	
	function fetchChildren(parentBody, templateAdapter, maxDepth, layoutOps) {
		var parentBody = jQuery(parentBody),
			parentNode = parentBody.parent()[0],
			data = jQuery(parentNode).data('node'),
			parentDepth = jQuery(parentNode).data('depth'),
			parentName = templateAdapter.getName(data),
			layoutBounds = layoutOps.getLayoutBounds(parentNode),
			svg = $(".vole-view-nested-svg").svg('get'),
			childNode;

		//display children if there is space or if the parent is unnamed 
		if (!parentName || parentDepth < maxDepth) {
			parentBody.addClass("async-wait");
			templateAdapter.getChildrenAsync(data).done(function (children) {
				parentBody.empty(); 
				//TODO hide background image, if there is one
				
				jQuery.each(children, function(index, child) {
					childNode = node(svg, parentBody, child, templateAdapter);
					jQuery(childNode).data('depth', parentDepth + 1);
				});
				
				vole.getLayout().doLayout(parentNode, getNodeOps(), true);
	
				parentBody.removeClass("children-to-fetch async-wait");
				
				if (children.length > 0) {
					parentBody.addClass("children");
				}
	
				//these both basically happen asynchronously: any node bodies marked "leaf to-fetch" will get images and any "children to-fetch" will get children
				fetchLeafImages(parentNode, templateAdapter);
				fetchDescendants(parentBody, templateAdapter, vole.getViewDepth(), layoutOps);
			});
		} else {
			parentBody.addClass("image-to-fetch");
			fetchLeafImages(parentNode, templateAdapter);
		}
	}

	function fetchLeafImages(container, templateHelper) {
//		jQuery(container).find("div.body.image-to-fetch").each(function(){
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
//			leafBody.removeClass("image-to-fetch");
//		});
	}
	
	/* ****************
	 * Event Handlers *
	 ******************/
	
	jQuery(".vole-view-nested-svg g.node").live('click', function(event) {
		var scene = jQuery(".vole-view-nested-svg g.scene")[0];
			
		console.log("clicked " + this);
		console.log("before:" + jQuery(scene).attr("transform"));
		zoomToFit(scene, this);
		console.log("after:" + jQuery(scene).attr("transform"));
		
		fetchDescendants(jQuery(this), jQuery(this).data('templateAdapter'), jQuery(this).data('depth') + 1, view.layoutOps);
		
		updateLOD(this.ownerSVGElement);
		
		return false;
	});
	
	$(".vole-view-nested-svg svg").live("mousewheel", function(event, delta) {
		var dir = delta > 0 ? 'Up' : 'Down',
			vel = Math.abs(delta),
			x, y, transform;
		
		console.log("wheel " + dir + " at page (" + event.pageX + ", " + event.pageY + ") at a velocity of " + vel);
		
		x = event.pageX - this.offsetLeft;
		y = event.pageY - this.offsetTop;
		
		zoom(this, delta, x, y);
		
		//TODO hide nodes that are too small or too big to be visible
		updateLOD(this);
		
        return false;
	});

	/* ***************
	 * Misc. Helpers *
	 *****************/
	
	function getNodeOps() {
		return jQuery.extend({}, vole.getAreaModel(), view.layoutOps);
	}
	
	function getRootNode() {
		return jQuery("g.node.root", viewContainer);
	}
	
	function zoomToFit(scene, element) {
//		jQuery(svg).attr('viewBox', getViewBox(svg, element)); //setting viewBox in chrome makes all of the getTransform type methods throw exceptions...
		var tx = getTransformToFit(scene, element);
		
		scene.transform.baseVal.initialize(tx);
		//TODO: will want to hide parent background fill, so we don't end up with white-on-white.  jQuery.fadeOut() doesn't work on <rect>, but animating the opacity and then display:none should work.
	}
	
	function getTransformToFit(scene, element) {
		var svg = scene.ownerSVGElement,
			box = element.getBBox(),
			m = svg.createSVGMatrix(),
			width = jQuery(svg).width(),
			height = jQuery(svg).height(),
			s;
		
		s = Math.min(width / box.width, height / box.height);
		m = m.scale(s);
		
		m = m.multiply(scene.getTransformToElement(element));
		
		return svg.createSVGTransformFromMatrix(m);
	}
	
	/*
	 * x, y are the desired center of the view, in screen pixels, relative to the upper left corner of the current view
	 */
	function zoom(svg, amount, x, y) {
		var m = svg.createSVGMatrix(),
			scene = jQuery(svg).children("g.scene")[0],
			scale = Math.pow(2, amount/4);
			
		//console.log("zooming " + scale + "X at viewport (" + x + ", " + y + ")");
		//jQuery(svg).parent().svg('get').line(null, x - 2, y + 0.5, x + 2.5, y + 0.5, {stroke:"red"});
		
		var viewportToScene = svg.getTransformToElement(scene);
		var pointInScene = viewportToScene.translate(x,y);
		var width = jQuery(svg).width() * viewportToScene.a;
		var height = jQuery(svg).height() * viewportToScene.d;
		
		//console.log("centering on scene (" + pointInScene.e + ", " + pointInScene.f + ")");
		//jQuery(svg).parent().svg('get').line(scene, pointInScene.e + 0.5, pointInScene.f - 2, pointInScene.e + 0.5, pointInScene.f + 2.5, {stroke:"yellow"});
		
		//move current transform back to origin
		m = scene.getTransformToElement(svg);
		m.e=0;
		m.f=0;

		m = m.translate(width / 2, height / 2); //center
		
		m = m.scale(scale); //zoom
		
		m = m.translate(-pointInScene.e, -pointInScene.f); //move clicked point to center
		
		scene.transform.baseVal.initialize(svg.createSVGTransformFromMatrix(m));
	}
	
	function updateLOD(svg) {
		
		jQuery(svg).find("g.node").each(function(index, element) {
			var scale = this.getTransformToElement(svg).a;
			console.log(scale);
			if (scale >= minScale && scale <= maxScale ) {
				jQuery(this).children("rect").show();
				jQuery(this).children("text").show();
				console.log("showing " + jQuery(this).children("text").text());
			} else {
				jQuery(this).children("rect").hide();
				jQuery(this).children("text").hide();
				console.log("hiding " + jQuery(this).children("text").text());
			}
		});
		
		
	}
	
	viewContainer.svg({
		onLoad: function(svgwrapper) {
			vole.addView(view.name, view);
		},
		settings: {width:"100%", height: "100%", version: "1.2"}
	});
	
	
})();
