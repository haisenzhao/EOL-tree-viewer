function EOLTreeMap(container) {
	jQuery("<div id='thejit' ></div>").appendTo(container);
	jQuery("<div id='jitdetail' ></div>").appendTo(container);
	
	var that = this;
	that.tm = that.getTM();
}

EOLTreeMap.prototype.ping = function (callback) {
	jQuery.ajax({
		type: "GET",
		url: "/api/ping",
		timeout: 3000,
		success: function (data, textStatus, XMLHttpRequest) {
			callback();
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			jQuery('#jitdetail').html("<h1>The EOL API service appears to be down.</h1>");
			console.log(XMLHttpRequest);
			console.log(textStatus);
			console.log(errorThrown);
			this.apifail = true;
		}
	});
};

/** loads a json tree */
EOLTreeMap.prototype.loadTree = function (tree) {
	this.tm.loadJSON(tree);
};

/** loads tree for the given taxonConceptID in the user's default classification (or a given classification NOT YET IMPLEMENTED). */
EOLTreeMap.prototype.loadTaxonConcept = function (taxonConceptID, classification) {
	//TODO: find this ID in the given classification and figure out how to map that to /navigation/show_tree_view/ ids, which don't seem to be the same

	var url = "/navigation/show_tree_view/" + taxonConceptID;
	console.log(url);
	var that = this;
//	jQuery.get(url, function (data) {
//		var tree = new TextHTMLTree(data, true);
//		that.loadTree(tree);
//		that.tm.view(taxonConceptID);
//	});

	jQuery.ajax({
		url: url,
		type: "GET",
		success: function (data, textStatus, XMLHttpRequest) {
			var tree = new TextHTMLTree(data, true);
			that.loadTree(tree);
			that.tm.view(taxonConceptID);
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			jQuery('#jitdetail').html("<h1>The EOL navigation service is not responding</h1>");
		}
	});
};

EOLTreeMap.prototype.getTM = function () {
	console.log("Starting tree viewer");

	var thisEOLTreeMap = this;

	var tm = new TM.Squarified({
		levelsToShow: 1,
		rootId: 'thejit',
		//addLeftClickHandler: true,
		//addRightClickHandler: true,
		selectPathOnHover: true,
		orientation: "v",
		titleHeight: 22,

		//Remove all element events before destroying it.
		onDestroyElement: function (content, tree, isLeaf, leaf) {
			if (leaf.clearAttributes) { 
				leaf.clearAttributes(); 
			}
		},
		
		onCreateElement:  function (content, node, isLeaf, head, body) {  
		
			if (node.id === 0) {
				return;
			}
			
			//make the node title a link to the EOL page
			jQuery(head).wrapInner(EOLTreeMap.link(node));
			
			//do breadcrumbs
			if (jQuery(content).parent().attr("id") === this.rootId) {
				jQuery(content).addClass("root");
				jQuery(head).addClass("root");
				var ancestor = node.parent;
				var bc = jQuery("<span class='breadcrumb'></span>");
				bc.prependTo(head);
				
				var handlerCreator = function (node) {
					return function (event) {
						thisEOLTreeMap.tm.view(node.id);
					};
				};
				
				while (ancestor !== null) {
					var handler = handlerCreator(ancestor);
					var link = jQuery("<a>" + ancestor.name + "</a>").click(handler);
					bc.prepend(" > ").prepend(link);
					ancestor = ancestor.parent;
				} 
			} else {
				//adding the click handler myself, to avoid it being added to the top title bar
				//TODO: this can be taken out of the if/else now
				//TODO: consider making that breadcrumb bar a separate element outside thejit, and go back to built-in click handler
				jQuery(head).click(function (eventObject) {
					//ignores clicks on links
					if (!(eventObject.target instanceof HTMLAnchorElement)) {
						thisEOLTreeMap.tm.onLeftClick(head);
					}
				});
			}

			if (isLeaf) {
				jQuery(head).addClass("loading");
			}

			EOLTreeMap.getAPIData(node, function () {
				if (isLeaf) {
					if (node.imageURL) {
						jQuery(".eol_page", head).wrap("<div class='title'></div>");
						var title = jQuery(".title", head);
						var container = jQuery(head);
						
						var image = new Image();
						image.src = node.imageURL;
						
						if (image.complete) {
							EOLTreeMap.placeNodeImage(image, container, title);
							jQuery("<div class='image'></div>").append(image).appendTo(head); //wrapping in a div to hide the overflow
							jQuery(head).removeClass("loading");
						} else {
							jQuery(image).load(function handler(eventObject) {
								EOLTreeMap.placeNodeImage(image, container, title);
								jQuery("<div class='image'></div>").append(image).appendTo(head); //wrapping in a div to hide the overflow
								jQuery(head).removeClass("loading");
							});
							
							jQuery(image).error(function handler(eventObject) {
								jQuery(head).removeClass("loading");
							});
						}
						
//						jQuery(image).load(function handler(eventObject) {
//							//TODO: does this callback work if the image has already been cached?
//							var imageAR = this.width / this.height;
//							
//							if (imageAR >= containerAR) {
//								//image aspect ratio is wider than container: fit height, center width overlap
//								var calcWidth = (availableHeight / this.height) * this.width;
//								this.height = availableHeight;
//								this.width = calcWidth; //force IE to maintain aspect ratio
//								jQuery(this).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
//							}
//							else {
//								//image aspect ratio is taller than container: fit width, center height overlap
//								var calcHeight = (container.innerWidth() / this.width) * this.height;
//								this.width = container.innerWidth();
//								this.height = calcHeight; //force IE to maintain aspect ratio
//								jQuery(this).css("marginTop",  (availableHeight - calcHeight) / 2);
//							}
//							
//							jQuery("<div class='image'></div>").append(this).appendTo(head); //wrapping in a div to hide the overflow
//							jQuery(head).removeClass("loading");
//						});
//						
//						jQuery(image).error(function handler(eventObject) {
//							jQuery(head).removeClass("loading");
//						});
					} else {
						jQuery(head).removeClass("loading");
					}
				}
			});
			
			jQuery(content).hover(
				function handlerIn(eventObject) {
					jQuery("#jitdetail").html(EOLTreeMap.getDetail(node));
				}, 
				function handlerOut(eventObject) {
					//do nothing?
				}
			);
		},
		
		request: function (nodeId, level, onComplete) {
			var url = "/navigation/show_tree_view/" + nodeId;
			jQuery.get(url, function (data) {
				var tree = new TextHTMLTree(data, false);
				onComplete.onComplete(nodeId, tree);
			});
		}
	});
	
	return tm;
};

EOLTreeMap.link = function (node) {
	var link = jQuery("<a></a>");
	if (node.data.path) {
		//return "<a class='eol_page' target='_blank' href=http://www.eol.org" + node.data.path + "></a>";
		link.attr("href", "http://www.eol.org" + node.data.path);
		link.addClass("eol_page");
		link.attr("target", "_blank");
	}
	return link;
};

EOLTreeMap.getDetail = function (node) {
	var tooltipHtml = "<div class=\"tip-title\">" + node.name + "</div>" + 
		"<div class=\"tip-text\" id='tip-text'></div>"; 
	if (node.imageURL) {
		tooltipHtml += "<img src='" + node.imageURL + "'></img>";
	}
	if (node.description) {
		tooltipHtml += "<div class='description'>" + node.description + "</div>";
	}
	
	return tooltipHtml;
};

EOLTreeMap.getAPIData = function (node, callback) {
	if (node.imageURL || node.description) {
		callback();
	}

	//get the tooltip content from the API
	var textType = "GeneralDescription";
	var url = "/api/pages/" + node.id + "?details=1&images=1&subject=" + textType;
	jQuery.get(url, 
		function (apiResponse) {
			//TODO: I should take all of the image URLs, as back up in case a server is down. (like right now, for example, lifedesks.org is down.)
			node.imageURL = jQuery("dataType:contains('StillImage')", apiResponse).siblings('mediaURL:first').text();
			
			//node.description = jQuery("dataObject:has(subject:contains('" + textType + "')) dc\\:description", apiResponse).text();
			//okay, this is absurd, but it appears to be the only way to get jQuery 1.3.2 to select this dc:description element in all browsers
			node.description = jQuery("subject:contains('" + textType + "')", apiResponse).parent().children().filter(function () {
				return this.tagName === "dc:description";
			}).text();
			callback();
		},
		'xml');
};

EOLTreeMap.placeNodeImage = function (image, container, title) {
	//TODO create a container before calling this that does not include the title
	var availableHeight = container.innerHeight() - title.outerHeight();
	var containerAR = container.innerWidth() / availableHeight;
	
	var imageAR = image.width / image.height;
	
	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height, center width overlap
		var calcWidth = (availableHeight / image.height) * image.width;
		image.height = availableHeight;
		image.width = calcWidth; //force IE to maintain aspect ratio
		jQuery(image).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
	}
	else {
		//image aspect ratio is taller than container: fit width, center height overlap
		var calcHeight = (container.innerWidth() / image.width) * image.height;
		image.width = container.innerWidth();
		image.height = calcHeight; //force IE to maintain aspect ratio
		jQuery(image).css("marginTop",  (availableHeight - calcHeight) / 2);
	}
};

//TreeUtil.loadAllChildren = function (tree, controller, callback) {
//	//TODO: move into TreeUtil.implement call?
//	if (tree.id === 0 || tree.data.childrenFetched) {
//		callback();
//	} else {
//		controller.request(tree.id, 0, {
//			onComplete: function(nodeId, subtree) {
//				for (child in subtree.children) {
//					if (!tree.children.containsID(subtree.children[child].id)) {
//						tree.children.push(subtree.children[child]); //TODO: update children's depths
//					}
//				}
//				tree.data.childrenFetched = true;
//				callback();
//			}
//		});
//	}
//};
//
//TreeUtil.getSubtreeWithAncestors = function(tree, id){
//	//TODO: move into TreeUtil.implement call?
//	if (tree.id == id) {
//		return jQuery.extend(true, {}, tree); //TODO: only copy to some depth, to avoid huge unnecessary subtree copies
//	}
//	for (var i = 0, ch = tree.children; i < ch.length; i++) {
//		var t = this.getSubtreeWithAncestors(ch[i], id);
//		if (t != null) {
//			//make a clone of the root of 'tree', make it the parent of t and return the clone
//			var root = jQuery.extend(false, {}, tree);
//			root.children = [t];
//			return root;
//		}
//	}
//	return null;
//};

TreeUtil.loadSubtrees = function (tree, controller) {
	var maxLevel = controller.request && controller.levelsToShow;
	var leaves = this.getLeaves(tree, maxLevel), len = leaves.length, selectedNode = {};
	if (len === 0) {
		controller.onComplete();
	}
	for (var i = 0, counter = 0; i < len; i++) {
		var leaf = leaves[i], id = leaf.node.id;
		selectedNode[id] = leaf.node;
		controller.request(id, leaf.level, {
			onComplete: function (nodeId, tree) {
				var parent = selectedNode[nodeId];
				
				//update the new descendants' depths relative to their new parent
				TreeUtil.each(tree, function (node) {
					node.depth += parent.depth;
				});
				
				var ch = tree.children;
				parent.children = ch;
				jQuery.each(parent.children, function (i, child) {
					child.parent = parent;
				});
				
				if (++counter === len) {
					controller.onComplete();
				}
			}
		});
	}
};

/* a hack of the JIT's TreeUtil to fix the current node's ancestor-siblings not loading.  
 * This is only useful if you are starting somewhere below depth=1 (kingdoms), i.e. for the 
 * browser extension or a viewer served with the EOL page.  For now it is useless and
 * somewhat broken.  I should reimplement this if I plan to use this on an EOL page.
 */
//TreeUtil.loadSubtrees = function (tree, controller) {
//	//TODO: move into TreeUtil.implement call?
//	//first, make sure the children of the root are all loaded
//	this.loadAllChildren(tree, controller, function () {
//		//on the callback, load subtrees
//		var maxLevel = controller.request && controller.levelsToShow;
//		var leaves = TreeUtil.getLeaves(tree, maxLevel),
//		len = leaves.length,
//		selectedNode = {};
//		if(len == 0) controller.onComplete();
//		for(var i=0, counter=0; i<len; i++) {
//			var leaf = leaves[i], id = leaf.node.id;
//			selectedNode[id] = leaf.node;
//			controller.request(id, leaf.level, {
//				onComplete: function(nodeId, tree) {
//					var ch = tree.children;
//					selectedNode[nodeId].children = ch;
//					
//					//update the new descendants' depths
//					TreeUtil.each(tree, function (node) {
//						node.depth += tree.depth;
//					});
//					
//					if(++counter == len) {
//						controller.onComplete();
//					}
//				}
//			});
//		}
//	});
//};

  /*
	Modifying the layout to sort equal-area nodes alphabetically

		par - The parent node of the json subtree.  
		ch - An Array of nodes
	  coord - A coordinates object specifying width, height, left and top style properties.
  */
TM.Squarified.prototype.processChildrenLayout = function (par, ch, coord) {
	//TODO: move into TM.Squarified.implement call
	//compute children real areas
	var parentArea = coord.width * coord.height;
	var i, totalChArea = 0, chArea = [];
	for (i = 0; i < ch.length; i++) {
		chArea[i] = parseFloat(ch[i].data.$area);
		totalChArea += chArea[i];
	}
	for (i = 0; i < chArea.length; i++) {
		ch[i]._area = parentArea * chArea[i] / totalChArea;
	}
	var minimumSideValue = (this.layout.horizontal())? coord.height : coord.width;
	ch.sort(this.sortComparator); //this is the modified line
	var initElem = [ch[0]];
	var tail = ch.slice(1);
	this.squarify(tail, initElem, minimumSideValue, coord);
};

TM.Squarified.prototype.sortComparator = function (a, b) {
	//TODO: move into TM.Squarified.implement call
	var diff = a._area - b._area;
	return diff || a.name.localeCompare(b.name);
};

///** Some JIT treemap overrides */
TM.Squarified.implement({

	//a no-prune version of out()
	out: function () {
		var parent = TreeUtil.getParent(this.tree, this.shownTree.id);
		if (parent) {
			this.view(parent.id);
		}
	},
	
	//a node is displayed as a leaf if it is at the max displayable depth or if it is actually a leaf
	leaf: function (tree) {
		return tree.depth >= this.shownTree.depth + this.controller.levelsToShow || tree.children === 0;
	},
	
	loadJSON: function (json) {
		//TODO: force the jitdetail div to clear when a new subtree is viewed
		this.shownTree = json; //moving shownTree up here so it's available to compute when it checks for leaf()
		this.controller.onBeforeCompute(json);
		var container = document.getElementById(this.rootId), width = container.offsetWidth, height = container.offsetHeight, offst = this.config.offset, offwdth = width - offst, offhght = height - offst - this.config.titleHeight;
		
		json.coord = {
			'height': height,
			'width': width,
			'top': 0,
			'left': 0
		};
		
		//replacing the $merge (not available outside jit) with a jQuery extend
		var coord = jQuery.extend(true, {}, json.coord);
		coord.width = offwdth;
		coord.height = offhght;
		
		this.compute(json, coord);
		container.innerHTML = this.plot(json);
		if (this.tree === null) {
			this.tree = json;
			this.path = [];
		}
		
		this.initializeElements();
		this.controller.onAfterCompute(json);
	}
});
	
Array.prototype.containsID = function (id) {
	for (var i in this) {
		if (this[i].id === id) {
			return true;
		}
	}
	return false;
};
