function EOLTreeMap(container) {
	jQuery("<div id='thejit' ></div>").appendTo(container);
	jQuery("<div id='jitdetail' ></div>").appendTo(container);
	
	this.tm = this.getTM();
	this.detailFrozen = false;
	
	var that = this;
	jQuery(document).keydown(function (eventObject) {
		if (eventObject.keyCode === 70) {
			that.detailFrozen = true;
		}
	});
	
	jQuery(document).keyup(function (eventObject) {
		if (eventObject.keyCode === 70) {
			that.detailFrozen = false;
		}
	});
	
	jQuery("#thejit").focus();
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
	var that = this;

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
			jQuery("a.eol_page", head).addClass("title");
			
			
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
				//adding the click handler myself, to avoid it being added to the top title bar and to ignore clicks on links
				jQuery(head).click(function (eventObject) {

					if (!(eventObject.target.nodeName === "A")) {
						thisEOLTreeMap.tm.onLeftClick(head);
					}
				});
			}

			if (isLeaf) {
				jQuery(head).addClass("loading");
			}

			EOLTreeMap.getAPIData(node, function () {
				if (isLeaf) {
					if (node.image) {
						//jQuery(".eol_page", head).wrap("<div class='title'></div>");
						var title = jQuery(".title", head);
						var availableHeight = jQuery(head).innerHeight() - title.outerHeight();
						var container = jQuery("<div class='image'></div>").appendTo(head).height(availableHeight);
						
						
						var image = new Image();
						image.src = node.image.url;
						
						if (image.complete) {
							EOLTreeMap.placeNodeImage(image, container, availableHeight);
							jQuery(image).appendTo(container);
							jQuery(head).removeClass("loading");
						} else {
							jQuery(image).load(function handler(eventObject) {
								EOLTreeMap.placeNodeImage(image, container, availableHeight);
								jQuery(image).appendTo(container);
								jQuery(head).removeClass("loading");
							});
							
							jQuery(image).error(function handler(eventObject) {
								jQuery(head).removeClass("loading");
							});
						}
						
					} else {
						jQuery(head).removeClass("loading");
						jQuery(head).append("<p>No image available</p>");
					}
				}
			});
			
			//TODO: hover() seems to be unreliable.  replace with .mouseenter() and .mouseleave()? (new in jQuery 1.4)
//				$(content).bind({
//				  click: function() {
//				    $(this).text('Mouse Clicked');
//				  },
//				  mouseenter: function() {
//				    $(this).text('Mouse Entered');
//				  },
//				  mouseleave: function() {
//				    $(this).text('Mouse Left');
//				  }
//				});
			
			jQuery(content).hover(
				function handlerIn(eventObject) {
					if (!thisEOLTreeMap.detailFrozen) {
						jQuery("#jitdetail").html(EOLTreeMap.getDetail(node));
					}
				}, 
				function handlerOut(eventObject) {
					if (!thisEOLTreeMap.detailFrozen) {
						jQuery("#jitdetail").empty();
					}
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
	var detail = jQuery("<div>");
	jQuery("<div>" + node.name + "</div>").addClass("title").appendTo(detail);
		
	if (node.image) {
		var image = new Image();
		image.src = node.image.url;
		var caption = jQuery("<figcaption>").html(node.image.title);
		jQuery("<figure>").append(image).append(caption).appendTo(detail);
	}
	if (node.text && node.text.description) {
		var description = jQuery("<div class='description'>" + node.text.description + "</div>");
		if (node.text.provider) {
			description.prepend("<h2>from " + node.text.provider.name + ": </h2>");
		}
		detail.append(description);
	}
	
	//make all the links open in a new page
	jQuery("a", detail).attr("target", "_blank");
	
	return detail;
};

EOLTreeMap.getAPIData = function (node, callback) {
	if (node.image || node.text) {
		callback();
	}

	//get the tooltip content from the API
	var textType = "GeneralDescription";
	var url = "/api/pages/" + node.id + "?details=1&images=1&subject=" + textType;
	jQuery.get(url, 
		function (apiResponse) {
			//TODO: move these into node.data
			
			var imageObjects = jQuery("dataType:contains('StillImage')", apiResponse).parent();
			imageObjects.each(function(index, imageObject) {
				//TODO: make each node have an array of images, so I can grab more for a slideshow later
				//TODO consider getting the image data_object separately, so I can get the associated taxon name instead of counting on the (often crappy) <title> field.  (requires an extra trip to the server, will slow things down.)
				//TODO: I should take all of the image mediaURLs, as back up in case a server is down. (like right now, for example, lifedesks.org is down.)
				node.image = {
					url: jQuery('mediaURL:first', imageObject).text(),
					title: jQuery('title', imageObject).text(), //FIXME this query seems to be failing on FF
					description: jQuery("dc\\:description", imageObject).text() || jQuery("description", imageObject).text() //note: the first query fails on Chrome, the second fails on FF
				};	
			});

			var textObjects = jQuery("subject:contains('" + textType + "')", apiResponse).parent();
			textObjects.each(function(index, textObject) {
				var provider = jQuery("agent[role='provider']", textObject);
				
				node.text = {
					description: jQuery("dc\\:description", textObject).text() || jQuery("description", textObject).text(), //note: the first query fails on Chrome, the second fails on FF
					provider: {
						homepage: provider.attr("homepage"),
						name: provider.text()
					}
				}
			});

			
			callback();
		},
		'xml');
};

EOLTreeMap.placeNodeImage = function (image, container, availableHeight) {
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
		return tree.depth >= this.shownTree.depth + this.controller.levelsToShow || tree.children.length === 0;
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
