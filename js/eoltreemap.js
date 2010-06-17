EOLTreeMap.config = {
	levelsToShow: 1,
	titleHeight: 22,
	offset:2
};

function EOLTreeMap(container) {

	this.rootId = container.id;
	jQuery(container).addClass("treemap-container");
	this.api = new EolApi();
	this.controller.api = this.api;
	this.nodeSelectHandlers = [];
	this.viewChangeHandlers = [];
	this.selectionFrozen = false;
	
	this.tree = EOLTreeMap.stump(); //start with a stump tree, so view() has something to graft to.  
	
	/* Using controller.onBeforeCompute to set this.shownTree before plot is 
	 * called, where it's needed for leaf calc.  But can't give controller 
	 * a field referring back to this EOLTreeMap because the reference cycle appears 
	 * to break Nicolas' JIT class system (it causes an infinite recursion in 
	 * $unlink())
	 */
	var that = this;
	this.controller.setShownTree = function(json) {
		this.shownTree = json;
		that.shownTree = json;
	}
	
	jQuery(".selectable").live("mouseenter", function() {
		that.select(this.id);
	});
	
	jQuery(".selectable").live("mouseleave", function() {
		that.select(null);
	});
	
	jQuery(document).keydown(function (eventObject) {
		if (eventObject.keyCode === 70) {
			that.selectionFrozen = true;
		}
	});
	
	jQuery(document).keyup(function (eventObject) {
		if (eventObject.keyCode === 70) {
			that.selectionFrozen = false;
			//TODO trigger a mouseenter on the currently hovered node to update selection
		}
	});
}

EOLTreeMap.prototype = new TM.Squarified(EOLTreeMap.config);
EOLTreeMap.prototype.constructor = EOLTreeMap;

/* 
 * Calls callback(node) when a node is 'selected' (for display, not navigation). 
 * Calls callback(null) when no node is selected.
 */
EOLTreeMap.prototype.addNodeSelectHandler = function(handler) {
	this.nodeSelectHandlers.push(handler);
};

EOLTreeMap.prototype.addViewChangeHandler = function(handler){
	this.viewChangeHandlers.push(handler);
};

EOLTreeMap.prototype.select = function(id) {
	if (!this.selectionFrozen) {
		var node = TreeUtil.getSubtree(this.tree, id);
		
		if (node && !node.apiContentFetched) {
			//current node and breadcrumb ancestors may not have been fetched yet
			var that = this;
			this.api.decorateNode(node, function () {
				node.apiContentFetched = true;
				that.select(id);
				//TODO need a way to cancel this if the user has moved the mouse out before the API call completes
			});
		}
		
		jQuery.each(this.nodeSelectHandlers, function(index, handler) {
			handler(node);
		});
	}
};

/*
 * Override of TM.view.  Fetches nodes (and their lineage) instead of just assuming they're 
 * already in the tree. For example, when the user jumps to a different classification
 * or loads a bookmarked URL.
 * Also, view(null) will just refresh the current view (recalculates layout for browser resize)
 */
EOLTreeMap.prototype.view = function(id) {
	if (id === null) {
		this.loadTree(this.shownTree.id); //recalculate and refresh
	}
	
	var that = this;
	var node = TreeUtil.getSubtree(this.tree, id);

	post = jQuery.extend({}, this.controller);
	post.onComplete = function() {
		that.loadTree(id);
		jQuery.each(that.viewChangeHandlers, function(index, handler) {
			handler(that.shownTree);
		});
	};

	if (!node) {
		this.api.hierarchy_entries(id, function (json) {
			that.graft(that.tree, json, function (newNode) {
				TreeUtil.loadSubtrees(newNode, post);
			});
		});
	} else {
		TreeUtil.loadSubtrees(node, post);
	}
};

/* 
 * Adds an EOL hierarchy entry to a subtree, fetching its ancestors as necessary 
 * json: the hierarchy entry
 * subtree: a subtree containing this entry
 * callback: callback(node_in_tree_for_json)
 */
EOLTreeMap.prototype.graft = function (subtree, json, callback) {
	var that = this;
	if(!subtree.children || subtree.children.length === 0) {
		//the ancestor's full node hasn't been fetched yet.  Get it, then try again.
		this.api.hierarchy_entries(subtree.taxonID, function (fullNode) {
			EOLTreeMap.prepareForTreeMap(fullNode);
			jQuery.extend(true, subtree, fullNode);
			that.graft(subtree, json, callback);
		});
	} else {
		var childMatch = jQuery.grep(subtree.children, function (child) {return child.taxonID == json.taxonID })[0];
		if (childMatch) {
			//found the location of the hierarchy entry
			EOLTreeMap.prepareForTreeMap(json);
			jQuery.extend(true, childMatch, json);
			callback(childMatch);
		} else {
			//try the next ancestor on json's array
			var nextAncestorID;
			if (subtree === this.tree) {
				//we're at the root, so the next ancestor is the classification
				nextAncestorID = jQuery.grep(this.tree.children, function (classification) { return classification.name == json.nameAccordingTo })[0].id;
			} else if (subtree.name == json.nameAccordingTo) {
				//we're at the classification, so the next ancestor is the hierarchy_entry root (e.g. the kingdom)
				nextAncestorID = json.ancestors[0].taxonID;
			} else {
				nextAncestorID = jQuery.grep(json.ancestors, function (ancestor) {return ancestor.parentNameUsageID == subtree.taxonID })[0].taxonID;
			}
			
			var nextAncestor = jQuery.grep(subtree.children, function (child) {return child.id == nextAncestorID })[0];
			this.graft(nextAncestor, json, callback);
		}
	}
};

EOLTreeMap.prepareForTreeMap = function (apiHierarchy) {
	//set some fields TM needs, if undefined
	TreeUtil.each(apiHierarchy, function (node) {
		node.id = node.id || node.taxonID;
		node.name = node.name || node.scientificName;
		node.children = node.children || [];
		//node.ancestors = node.ancestors || [];
		node.data = node.data || {};
		node.data.$area = node.data.$area || 1.0;
	});
}

EOLTreeMap.stump = function () {
	/* 
	 * TODO: put the rest of the roots in (for all classifications).
	 * TODO: Do I need to add the classifications to ancestor arrays for all nodes?
	 */
	var col = {
		id:"COL",  name:"Species 2000 & ITIS Catalogue of Life: Annual Checklist 2009", image:{mediaURL:"http://www.catalogueoflife.org/annual-checklist/2009/images/2009_checklist_cd_front_cover.jpg"},
		children: [{taxonID:"24974884", taxonConceptID:"1", scientificName:"Animalia"}, {taxonID:"26322083", taxonConceptID:"7920", scientificName:"Archaea"}, {taxonID:"27919817", taxonConceptID:"288", scientificName:"Bacteria"}, {taxonID:"26310295", taxonConceptID:"3352", scientificName:"Chromista"}, {taxonID:"26250396", taxonConceptID:"5559", scientificName:"Fungi"}, {taxonID:"26017607", taxonConceptID:"281", scientificName:"Plantae"}, {taxonID:"26301920", taxonConceptID:"4651", scientificName:"Protozoa"}, {taxonID:"26319587", taxonConceptID:"5006", scientificName:"Viruses"}]
	};
	
	var ncbi = {
		id:"NCBI", name:"NCBI Taxonomy", image:{mediaURL:"http://www.ncbi.nlm.nih.gov/projects/GeneTests/static/img/white_ncbi.png"},
		children: [{taxonID:"28670753", taxonConceptID:"11660866", scientificName:"cellular organisms"}, {taxonID:"28665715", taxonConceptID:"11655828", scientificName:"other sequences"}, {taxonID:"28665429", taxonConceptID:"11655542", scientificName:"unclassified sequences"}, {taxonID:"28665341", taxonConceptID:"9157757", scientificName:"Viroids"}, {taxonID:"28612987", taxonConceptID:"5006", scientificName:"Viruses"}]
	};
	
	var iucn = {
			id:"IUCN", name:"IUCN Red List (Species Assessed for Global Conservation)", image:{mediaURL:"images/iucn_high_res.jpg"},
			children: [{taxonID:"24913771", taxonConceptID:"1", scientificName:"Animalia"}, {taxonID:"24925347", taxonConceptID:"5559", scientificName:"Fungi"}, {taxonID:"24913778", taxonConceptID:"281", scientificName:"Plantae"}, {taxonID:"24920520", taxonConceptID:"3121393", scientificName:"Protista"}]
	};
	
	var fishbase = {
			id:"FishBase", name:"FishBase (Fish Species)", image:{mediaURL:"http://bio.slu.edu/mayden/cypriniformes/images/fishbase_logo.jpg"},
			children: [{taxonID:"24876515", taxonConceptID:"1", scientificName:""}]
	};
	
//	var ncbi = {
//			id:"", name:"", image:{mediaURL:""},
//			children: [{taxonID:"", taxonConceptID:"", scientificName:""}]
//	};
	
	var tree = {
		id:"HOME",  name:"Classifications",
		children: [col, iucn, ncbi, fishbase]
	};
	
	//so sure we don't try to do EOL API calls for these dummy nodes
	tree.apiContentFetched = true;
	jQuery.each(tree.children, function(index, child) {child.apiContentFetched = true;});
	
	TreeUtil.each(tree, function (node) {
		EOLTreeMap.prepareForTreeMap(node);
	});
	
	return tree;
}

EOLTreeMap.setAreas = function (tree, computeArea) {
	//go over the whole tree and apply compteArea to nodes
	TreeUtil.each(tree, function (node) {
		node.data.$area = computeArea(node);
	});
};

EOLTreeMap.resizeImage = function (image, container) {
	container = jQuery(container);
	var containerAR = container.innerWidth() / container.innerHeight();
	
	var imageAR = image.naturalWidth / image.naturalHeight;
	
	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height, center width overlap
		var calcWidth = (container.innerHeight() / image.naturalHeight) * image.naturalWidth;
		image.height = container.innerHeight();
		image.width = calcWidth; //force IE to maintain aspect ratio
		jQuery(image).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
	}
	else {
		//image aspect ratio is taller than container: fit width, center height overlap
		var calcHeight = (container.innerWidth() / image.naturalWidth) * image.naturalHeight;
		image.width = container.innerWidth();
		image.height = calcHeight; //force IE to maintain aspect ratio
		jQuery(image).css("marginTop",  (container.innerHeight() - calcHeight) / 2);
	}
};

EOLTreeMap.help = "<div id='help'><h2>Instructions</h2><div><ul><li>Hover the mouse over a taxon image to see details about that taxon.  To freeze the details panel (so you can click links, select text, etc.), hold down the F key.</li>  <li>Left-click the image to view its subtaxa.</li>  <li>Left-click the underlined taxon name to go to the EOL page for that taxon.</li> <li>Left click the (non-underlined) taxon names in the 'breadcrumb trail' at the top to view supertaxa of this taxon</li> <li>Use your browser's back and next buttons, as you usually would, to see the previous or next page in your history, respectively.</li></div><p>Learn more about the project, download the source code, or leave feedback at the <a href='http://github.com/kurie/EOL-tree-viewer'>GitHub repository</a>. </div>";


/* Overrides TM.createBox to render a leaf with title and image */
EOLTreeMap.prototype.createBox = function (json, coord, html) {
	var box;
	if (this.leaf(json)) {
		if (this.config.Color.allow) {
			box = this.leafBox(json, coord);
		} else {
			box = this.headBox(json, coord) + this.bodyBox("", coord);
		}
	} else {
		if (json.id === this.shownTree.id) {
			box = this.breadcrumbBox(json, coord) + this.bodyBox(html, coord);
		} else {
			box = this.headBox(json, coord) + this.bodyBox(html, coord);
		}
	}

	return this.contentBox(json, coord, box);
};

EOLTreeMap.prototype.contentBox = function(json, coord, html) {
    var c = {};
    for(var i in coord) c[i] = coord[i] + "px";
    return "<div class=\"content selectable\" style=\"" + this.toStyle(c) 
       + "\" id=\"" + json.id + "\">" + html + "</div>";
};

EOLTreeMap.prototype.breadcrumbBox = function(json, coord) {
    var config = this.config, offst = config.offset;
    var c = {
      'height': config.titleHeight + "px",
      'width': (coord.width - offst) + "px",
      'left':  offst / 2 + "px"
    };
    
	//make the root node and classification the first breadcrumbs
	var breadcrumbs = "<a class='breadcrumb ancestor' href='#HOME' id='HOME'>Home</a>";
	breadcrumbs += " > ";
    if (json.nameAccordingTo) {
    	var shortClassificationName = jQuery.grep(this.tree.children, function (classification){return classification.name == json.nameAccordingTo[0]})[0].id;
    	breadcrumbs += "<a class='breadcrumb ancestor selectable' href='#" + shortClassificationName + "' id='" + shortClassificationName + "'>" + shortClassificationName + "</a>";
		breadcrumbs += " > ";
    }
    
    //add the ancestors
    if (json.ancestors) {
	    jQuery.each(json.ancestors, function (index, ancestor) {
	    	breadcrumbs += "<a class='breadcrumb ancestor selectable' href='#" + ancestor.taxonID + "' id='" + ancestor.taxonID + "'>" + ancestor.scientificName + "</a>";
			breadcrumbs += " > ";
	    });
    }
	
	//wrap the ancestors and their brackets > in a span so they can be styled as a group
	breadcrumbs = "<span class='breadcrumb ancestors'>" + breadcrumbs + "</span>";
    
    //add the current node as a link out to EOL
    if (json.taxonConceptID) {
    	breadcrumbs += "<a class='breadcrumb current selectable' target='_blank' href='http://www.eol.org/" + json.taxonConceptID + "' id='" + json.id + "'>" + json.name + "</a>";
    } else {
    	breadcrumbs += json.name;
    }
    
    return "<div class=\"head\" style=\"" + this.toStyle(c) + "\">" + breadcrumbs + "</div>";
};

EOLTreeMap.prototype.leaf = function (node) {
	return this.controller.leaf(node, this.tree, this.shownTree);
};

/* Minor edit of processChildrenLayout to sort equal-area nodes alphabetically */
EOLTreeMap.prototype.processChildrenLayout = function (par, ch, coord) {
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
	
	//kgu: sorting by area (required for treemap), then name.  Most of the time areas are all going to be the same.
	ch.sort(function (a, b) {
		var diff = a._area - b._area;
		return diff || a.name.localeCompare(b.name);
	});
	
	var initElem = [ch[0]];
	var tail = ch.slice(1);
	this.squarify(tail, initElem, minimumSideValue, coord);
};

EOLTreeMap.prototype.controller.onDestroyElement = function (content, tree, isLeaf, leaf) {
	if (leaf.clearAttributes) { 
		//Remove all element events before destroying it.
		leaf.clearAttributes(); 
	}
};

EOLTreeMap.prototype.controller.onCreateElement = function (content, node, isLeaf, head, body) {  
	isLeaf = jQuery(body).children().length === 0; //overwriting JIT's isLeaf because I gave leaves a head and body 
	if (!this.Color.allow && node != null && isLeaf) {
		this.insertBodyContent(node, body);
	}
};

EOLTreeMap.prototype.controller.onBeforeCompute = function(tree){
	this.setShownTree(tree);
};

EOLTreeMap.prototype.controller.onAfterCompute = function (tree) {
	/*
	 * Adding these elements to the tree in the plotting (createBox, etc...) 
	 * functions or in onCreateElement breaks the tree traversal in 
	 * initializeElements, so I have to add them here
	 */
	
	//Wrap an EOL link around all head divs and a navigation hash link around all of the body divs
	var that = this;
	jQuery("#" + tree.id).find("div .content").each(function (index, element) {
		var node = TreeUtil.getSubtree(tree, this.id);
		var elem1 = jQuery(this).children()[0];
		var elem2 = jQuery(this).children()[1];
		
		if (node && elem1 && node.taxonConceptID) {
			jQuery(elem1).wrap("<a class='head' target='_blank' href=http://www.eol.org/" + node.taxonConceptID + "></a>");
		}
		
		if (elem2) {
			jQuery(elem2).wrap("<a class='body' href=#" + node.id + "></a>");
		}
	});

	var helpButton = jQuery("<span class='helpButton'>?</span>");
	helpButton.mouseenter(function (eventObject) {
		helpButton.addClass("hover");
		
		//TODO make a detail empty function somewhere
		jQuery("#jitdetail div.title").empty();
		jQuery("#jitdetail figure div.image").empty();
		jQuery("#jitdetail figure figcaption").empty();
		jQuery("#jitdetail div.description h2").empty();
		jQuery("#jitdetail div.description div").empty();
		
		jQuery("#jitdetail .description div").html(EOLTreeMap.help);
		jQuery("#jitdetail .title").html("About the EOL TreeMap Viewer");
	});
	
	helpButton.mouseleave(function (eventObject) {
		helpButton.removeClass("hover");
	});
	jQuery("#" + tree.id).prepend(helpButton);
	
	jQuery(".treemap-container > div.content div.content > a.head > div.head").each(function (index, element) {
		var fontsize = jQuery(this).css("font-size").replace("px","");
		while(this.scrollWidth > this.offsetWidth && fontsize >= 6) {
			fontsize -= 1;
			jQuery(this).css("font-size", fontsize + "px");
		}
	});
}

EOLTreeMap.prototype.controller.request = function (nodeId, level, onComplete) {
	//TODO: this only gets one level of descendants.  Check the level param for how many levels we should be getting. (Find out if it is relative or absolute depth.)
	this.api.hierarchy_entries(nodeId, function (json) {
		EOLTreeMap.prepareForTreeMap(json);
		onComplete.onComplete(nodeId, json);
	});
};

EOLTreeMap.prototype.controller.insertBodyContent = function (node, container) {
	var that = this;
	
	if (jQuery(container).children().length === 0) {
		var placeholder = new Image();
		placeholder.src = "images/ajax-loader.gif";
		jQuery(container).html(placeholder);
	}
	
	if (!node.apiContentFetched) {
		this.api.decorateNode(node, function () {
			node.apiContentFetched = true;
			that.insertBodyContent(node, container);
		});
		return;
	}
	
	if (node.image) {
		if (node.image.image && node.image.image.src) { //for some reason, IE (only) is resetting these images to have no src...
			this.insertImage(node.image.image, container, function(){});
		} else if (node.image.eolThumbnailURL) { 
			if (!node.image.thumb || !node.image.thumb.src) {
				node.image.thumb = new Image();
				node.image.thumb.src = node.image.eolThumbnailURL;
			}
			this.insertImage(node.image.thumb, container, function(){
				if (node.image.thumb.naturalWidth < jQuery(container).innerWidth()) {
					node.image.image = new Image();
					node.image.image.src = node.image.eolMediaURL;
					that.insertImage(node.image.image, container, function(){});
				}
			});
		} else if (node.image.eolMediaURL) {
			node.image.image = new Image();
			node.image.image.src = node.image.eolMediaURL;
			that.insertImage(node.image.image, container, function(){});
		} else if (node.image.mediaURL) {
			node.image.image = new Image();
			node.image.image.src = node.image.mediaURL;
			that.insertImage(node.image.image, container, function(){});
		}
	} else {
		jQuery(container).html("No image available");
	}

};

EOLTreeMap.prototype.controller.insertImage = function (image, container, callback) {
	if (image.complete || image.readyState == "complete") {
		//have to set these for IE.  (They already exist in other browsers...)
		if (!image.naturalHeight || !image.naturalWidth) {
			image.naturalWidth = image.width;
			image.naturalHeight = image.height;
		}
		
		EOLTreeMap.resizeImage(image, container);
		jQuery(container).html(image);
		callback();
	} else {
		jQuery(image).load(function handler(eventObject) {
			if (!image.naturalHeight || !image.naturalWidth) {
				image.naturalWidth = image.width;
				image.naturalHeight = image.height;
			}
			
			EOLTreeMap.resizeImage(image, container);
			jQuery(container).html(image);
			callback();
		});
		
		jQuery(image).error(function handler(eventObject) {
			jQuery(container).html("No image available");
			callback();
		});
	}
};

/* a node is displayed as a leaf if it is at the max displayable depth or if it is actually a leaf in the current tree */
EOLTreeMap.prototype.controller.leaf = function (node, tree, shownTree) {
	return node.children.length === 0 ||
			(TreeUtil.depth(node, tree) >= TreeUtil.depth(shownTree, tree) + this.levelsToShow);
};

TreeUtil.depth = function (node, tree) {
	//TODO kind of ad-hoc.  Do this in a more robust way.
	if (node === tree) {
		return 0;
	} else if (node.ancestors === undefined) {
		return 1;
	} else {
		return node.ancestors.length + 2;
	}
}

/* A minor edit to loadSubtrees to make it merge the entire incoming json node 
 * with the existing node, instead of just tacking on the new child array */
TreeUtil.loadSubtrees = function(tree, controller){
    var maxLevel = controller.request && controller.levelsToShow;
    var leaves = this.getLeaves(tree, maxLevel), len = leaves.length, selectedNode = {};
    if (len == 0) 
        controller.onComplete();
    for (var i = 0, counter = 0; i < len; i++) {
        var leaf = leaves[i], id = leaf.node.id;
        selectedNode[id] = leaf.node;
        controller.request(id, leaf.level, {
            onComplete: function(nodeId, tree){
                //var ch = tree.children;
                //selectedNode[nodeId].children = ch;
				jQuery.extend(true, selectedNode[nodeId], tree);
                if (++counter == len) {
                    controller.onComplete();
                }
            }
        });
    }
};


