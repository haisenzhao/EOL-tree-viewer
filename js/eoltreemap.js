function EOLTreeMap(container) {
	this.rootId = container.id;
	jQuery(container).addClass("treemap-container");
	
	var controller = new EOLTreeMapController(container.id);
	this.initialize({"rootId":controller.rootId, "Tips":controller.Tips});
	this.controller = this.config = controller; //JIT's TM.initialize() uses $merge() which breaks my controller's binding to its options form
	
	this.api = new EolApi();
	this.controller.api = this.api;
	
	/** 
	 * returns new custom taxon objects instead of hierarchy_entries objects
	 */
	this.api.fetchNode = function (taxonID, onSuccess) {
		this.hierarchy_entries(taxonID, function (json) {
			var taxon = new Taxon(json);
			onSuccess(taxon);
		});
	};

	TreeUtil.loadSubtrees = EOLTreeMap.loadSubtrees; //override TreeUtil.loadSubtrees with mine
	
	this.nodeSelectHandlers = [];
	this.viewChangeHandlers = [];
	this.selectionFrozen = false;
	
	this.tree = EOLTreeMap.stump(); //start with a stump tree, so view() has something to graft to.  
	
	/* Add mouse and keyboard event handlers */
	var that = this;
	
	jQuery(".selectable").live("mouseenter", function() {
		that.select(this.id);
	});
	
	jQuery(".selectable").live("mouseleave", function() {
		that.select(null);
	});
	
	jQuery("div.content").live("click", function() {
		window.location.hash = this.id;
	});
	
	//show EOL logo when hovering a link out to EOL
	jQuery("a.head").live("mouseenter", function () {
		jQuery("#_tooltip").html("<img src='images/eol_logo.gif' />");
	});
	
	//force body element to trigger mouseovers on its parent (div.content)
	jQuery("div.body").live("mouseover", function () {
		jQuery(this).parent().mouseover();
	});
	
	jQuery(document).keydown(function (eventObject) {
		if (eventObject.keyCode === 70) {
			that.selectionFrozen = true;
			jQuery("img.freeze-indicator").show();
		}
	});
	
	jQuery(document).keyup(function (eventObject) {
		if (eventObject.keyCode === 70) {
			that.selectionFrozen = false;
			jQuery("img.freeze-indicator").hide();
			
			//update the selection to the currently hovered node
			var hoverId = jQuery(".selectable:hover").last().attr("id");
			if (hoverId) {
				that.select(hoverId);
			}
		}
	});
	
	this.addNodeSelectHandler(function (node) {
		//update freeze indicator position
		var newParent;
		if (node != null) {
			newParent = jQuery("#" + node.id);
		} else {
			newParent = jQuery(".treemap-container");
		}
		jQuery("img.freeze-indicator").detach().appendTo(newParent);
	});
	
	this.addNodeSelectHandler(function (node) {
		//add highlight class to selected node and ancestors
		if (node && node.id) {
			jQuery("#" + that.rootId + " div.content").removeClass("highlight").filter("#" + node.id).addClass("highlight").parents("div.content").addClass("highlight");
		}
	});
}

EOLTreeMap.prototype = new TM.Squarified();
EOLTreeMap.prototype.constructor = EOLTreeMap;

EOLTreeMap.prototype.getOptionsForm = function () {
	var form = this.controller.optionsForm;
	var that = this;
	
	// any form element change triggers a refresh
	jQuery(form).change(function() {
		that.view(that.shownTree.id);
		return false;
	});
	
	// size/scale binding to taxon
	var sizeVariableList = jQuery("#sizeVariable", form);
	var scaleVariableList = jQuery("#sizeScaling", form);
	Taxon.prototype.getArea = function() {
		var scaleFunc = that.controller.scale[scaleVariableList.val()].func;
		var value = that.controller.stats[sizeVariableList.val()].func(this);
		return scaleFunc(value) || 1.0;
	};
	
	// color binding to taxon
	var colorVariableList = jQuery("#colorVariable", form);
	Taxon.prototype.getColor = function(){
		return that.controller.stats[colorVariableList.val()].func(this) || 0;
	};
	
	return form;
};

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
		var selectedNode = TreeUtil.getSubtree(this.tree, id);
		var that = this;
		
		if (selectedNode && !selectedNode.apiContentFetched) {
			//current node and breadcrumb ancestors may not have been fetched yet
			this.api.decorateNode(selectedNode, function () {
				selectedNode.apiContentFetched = true;
				
				//if user is still hovering that node, go ahead and select it again now that the api content is available
				var hoverId = jQuery(".selectable:hover").last().attr("id");
				if (id === hoverId) {
					that.select(id);
				}
			});
		}
		
		jQuery.each(this.nodeSelectHandlers, function(index, handler) {
			handler(selectedNode);
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
	
	//show a progress pointer
	var rootElement = jQuery("#" + this.rootId);
	rootElement.css("cursor", "progress");
//	jQuery("#" + this.rootId).append("<img src='images/ajax-loader.gif' class='overlay-image'/>");
	jQuery("<div class='overlay'>").appendTo(rootElement).width(rootElement.innerWidth()).height(rootElement.innerHeight());
	
    /* JIT leaves the layout orientation set to whatever it was at the
     * end of the last draw, which sometimes makes the layout alternate between 
     * horizontal and vertical on successive refreshes of the same node, so I'm
     * resetting it here.
     */ 	
	this.layout.orientation = this.config.orientation;
	 
	if (id === null) {
		this.loadTree(this.shownTree.id); //recalculate and refresh
	}
	
	var that = this;

	post = jQuery.extend({}, this.controller);
	post.onComplete = function() {
		that.shownTree = TreeUtil.getSubtree(that.tree, id);
		that.loadTree(id);
		jQuery("<img class='freeze-indicator' src='images/Snowflake-black.png'>").appendTo("#" + that.rootId).hide();
		jQuery.each(that.viewChangeHandlers, function(index, handler) {
			handler(that.shownTree);
		});
		
		jQuery("#" + that.rootId).css("cursor", "auto");
	};

	var node = TreeUtil.getSubtree(this.tree, id);
	if (node) {
		TreeUtil.loadSubtrees(node, post, this.controller.levelsToShow);
	} else {
		this.api.fetchNode(id, function (json) {
			try {
				that.graft(that.tree, json, function (newNode) {
					TreeUtil.loadSubtrees(newNode, post, that.controller.levelsToShow);
				});
			} catch (error) {
//				console.log(error.msg);
			}
		});
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
		this.api.fetchNode(subtree.taxonID, function (fullNode) {
			subtree.merge(fullNode);
			that.graft(subtree, json, callback);
		});
	} else {
		var childMatch = jQuery.grep(subtree.children, function (child) {return child.taxonID == json.taxonID })[0];
		if (childMatch) {
			//found the location of the hierarchy entry
			childMatch.merge(json);
			callback(childMatch);
		} else {
			//try the next ancestor on json's array
			var nextAncestorID;
			if (subtree === this.tree) {
				//we're at the root, so the next ancestor is the classification
				var classificationMatches = jQuery.grep(this.tree.children, function (classification) { return classification.name == json.nameAccordingTo[0] });
				if (classificationMatches.length > 0) {
					nextAncestorID = classificationMatches[0].id;
				} else {
					//uh oh, no classification has the same name as the json response
					//TODO add a new classification to the tree
					var error = {msg: "EOLTreeMap.prototype.graft: The json.nameAccordingTo classification not found", json:json};
					throw(error);
				}
			} else if (subtree.name == json.nameAccordingTo[0]) {
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

EOLTreeMap.stump = function () {
	
	/* TODO: put the rest of the roots in (for all classifications).*/
	var col = new Taxon(null, "COL", "Species 2000 & ITIS Catalogue of Life: Annual Checklist 2009");
	col.image = {mediaURL:"http://www.catalogueoflife.org/annual-checklist/2009/images/2009_checklist_cd_front_cover.jpg"};
	col.text = {description:"<p><b>CoL</b> <a href='http://www.catalogueoflife.org/'>http://www.catalogueoflife.org/</a><br>The Catalogue of Life Partnership (CoLP) is an informal partnership dedicated to creating an index of the world’s organisms, called the Catalogue of Life (CoL). The CoL provides different forms of access to an integrated, quality, maintained, comprehensive consensus species checklist and taxonomic hierarchy, presently covering more than one million species, and intended to cover all know species in the near future. The Annual Checklist EOL uses contains substantial contributions of taxonomic expertise from more than fifty organizations around the world, integrated into a single work by the ongoing work of the CoLP partners. EOL currently uses the CoL Annual Checklist as its taxonomic backbone.</p>"};
	
	col.children = [
	    new Taxon({taxonID:"24974884", taxonConceptID:"1", scientificName:"Animalia"}),
	    new Taxon({taxonID:"26322083", taxonConceptID:"7920", scientificName:"Archaea"}),
	    new Taxon({taxonID:"27919817", taxonConceptID:"288", scientificName:"Bacteria"}),
	    new Taxon({taxonID:"26310295", taxonConceptID:"3352", scientificName:"Chromista"}),
	    new Taxon({taxonID:"26250396", taxonConceptID:"5559", scientificName:"Fungi"}),
	    new Taxon({taxonID:"26017607", taxonConceptID:"281", scientificName:"Plantae"}),
	    new Taxon({taxonID:"26301920", taxonConceptID:"4651", scientificName:"Protozoa"}),
	    new Taxon({taxonID:"26319587", taxonConceptID:"5006", scientificName:"Viruses"})
	];
	col.setAsParent();
	
	var ncbi = new Taxon(null, "NCBI", "NCBI Taxonomy");
	ncbi.image = {mediaURL:"http://www.ncbi.nlm.nih.gov/projects/GeneTests/static/img/white_ncbi.png"};
	ncbi.text = {description:"<p><b>NCBI</b> <a href='http://www.ncbi.nlm.nih.gov/'>http://www.ncbi.nlm.nih.gov</a><br>As a U.S. national resource for molecular biology information, NCBI's mission is to develop new information technologies to aid in the understanding of fundamental molecular and genetic processes that control health and disease. The NCBI taxonomy database contains the names of all organisms that are represented in the genetic databases with at least one nucleotide or protein sequence.</p>"};
	
	ncbi.children = [
	    new Taxon({taxonID:"28670753", taxonConceptID:"11660866", scientificName:"cellular organisms"}),
	    new Taxon({taxonID:"28665715", taxonConceptID:"11655828", scientificName:"other sequences"}),
	    new Taxon({taxonID:"28665429", taxonConceptID:"11655542", scientificName:"unclassified sequences"}),
	    new Taxon({taxonID:"28665341", taxonConceptID:"9157757", scientificName:"Viroids"}), 
	    new Taxon({taxonID:"28612987", taxonConceptID:"5006", scientificName:"Viruses"})
	];
	ncbi.setAsParent();
	
	var iucn = new Taxon(null, "IUCN", "IUCN Red List (Species Assessed for Global Conservation)");
	iucn.image = {mediaURL:"images/iucn_high_res.jpg"};
	iucn.text = {description:"<p><b>IUCN</b> <a href='http://www.iucn.org//'>http://www.iucn.org/</a><br>International Union for Conservation of Nature (IUCN) helps the world find pragmatic solutions to our most pressing environment and development challenges. IUCN supports scientific research; manages field projects all over the world; and brings governments, non-government organizations, United Nations agencies, companies and local communities together to develop and implement policy, laws and best practice. EOL partnered with the IUCN to indicate status of each species according to the Red List of Threatened Species.</p>"};
	
	iucn.children = [
	    new Taxon({taxonID:"24913771", taxonConceptID:"1", scientificName:"Animalia"}), 
        new Taxon({taxonID:"24925347", taxonConceptID:"5559", scientificName:"Fungi"}), 
        new Taxon({taxonID:"24913778", taxonConceptID:"281", scientificName:"Plantae"}), 
        new Taxon({taxonID:"24920520", taxonConceptID:"3121393", scientificName:"Protista"})
	];
	iucn.setAsParent();
	
	var fishbase = new Taxon(null, "FishBase", "FishBase (Fish Species)");
	fishbase.image = {mediaURL:"http://bio.slu.edu/mayden/cypriniformes/images/fishbase_logo.jpg"};
	fishbase.text = {description:"<p><b>FishBase</b> <a href='http://www.fishbase.org/'>http://www.fishbase.org/</a><br>FishBase is a global information system with all you ever wanted to know about fishes. FishBase is a relational database with information to cater to different professionals such as research scientists, fisheries managers, zoologists and many more. The FishBase Website contains data on practically every fish species known to science. The project was developed at the WorldFish Center in collaboration with the Food and Agriculture Organization of the United Nations and many other partners, and with support from the European Commission. FishBase is serving information on more than 30,000 fish species through EOL.</p>"};
	
	fishbase.children = [
	    new Taxon({taxonID:"24876515", taxonConceptID:"1", scientificName:""})
	];
	fishbase.setAsParent();
	
	var tree = new Taxon(null, "HOME", "Classifications");
	tree.children = [col, iucn, ncbi, fishbase];
	tree.setAsParent();

	//make sure we don't try to do EOL API calls for these dummy nodes
	tree.apiContentFetched = true;
	jQuery.each(tree.children, function(index, child) {child.apiContentFetched = true;});
	
	return tree;
}

EOLTreeMap.resizeImage = function (image, container) {
	container = jQuery(container);
	var containerAR = container.innerWidth() / container.innerHeight();
	
	var imageAR = image.naturalWidth / image.naturalHeight;
	
	if (imageAR >= containerAR) {
		//image aspect ratio is wider than container: fit height, center width overlap
		var calcWidth = (container.innerHeight() / image.naturalHeight) * image.naturalWidth;
		image.height = container.innerHeight();
		image.width = calcWidth; //force IE to maintain aspect ratio
		jQuery(image).css("marginTop", 0);
		jQuery(image).css("marginLeft",  (container.innerWidth() - calcWidth) / 2);
	}
	else {
		//image aspect ratio is taller than container: fit width, center height overlap
		var calcHeight = (container.innerWidth() / image.naturalWidth) * image.naturalHeight;
		image.width = container.innerWidth();
		image.height = calcHeight; //force IE to maintain aspect ratio
		jQuery(image).css("marginTop",  (container.innerHeight() - calcHeight) / 2);
		jQuery(image).css("marginLeft", 0);
	}
};

EOLTreeMap.help = "<div class='help'><h2>Instructions</h2><div><ul><li>Hover the mouse over a taxon image to see details about that taxon.  To freeze the details panel (so you can click links, select text, etc.), hold down the F key.</li>  <li>Left-click the image to view its subtaxa.</li>  <li>Left-click the underlined taxon name to go to the EOL page for that taxon.</li> <li>Left click the (non-underlined) taxon names in the 'breadcrumb trail' at the top to view supertaxa of this taxon</li> <li>Use your browser's back and next buttons, as you usually would, to see the previous or next page in your history, respectively.</li></div><p>Learn more about the project, download the source code, or leave feedback at the <a href='http://github.com/kurie/EOL-tree-viewer'>GitHub repository</a>. </div>";

/* Overrides TM.plot */
EOLTreeMap.prototype.plot = function(taxon){
	var coord = taxon.coord, html = "";
	
	if (!this.isDisplayLeaf(taxon)) {
		for (var i = 0, ch = taxon.children; i < ch.length; i++) {
			var chi = ch[i], chcoord = chi.coord;
			//skip tiny nodes
			if (chcoord.width * chcoord.height > 1) {
				html += this.plot(chi);
			}
		}
	}
	
    return this.createBox(taxon, coord, html);
  }

/* Overrides TM.createBox to render a leaf with head and body */
EOLTreeMap.prototype.createBox = function (taxon, coord, html) {
	var box;
	
	coord.width -= 2 * this.config.borderWidth;
	coord.height -= 2 * this.config.borderWidth;
	
	if (taxon.id === this.shownTree.id) {
		//viewed subtree root, show breadcrumbs in place of usual header
		box = this.breadcrumbBox(taxon, coord) + this.bodyBox(html, coord);
	} else {
		box = this.headBox(taxon, coord) + this.bodyBox(html, coord);
	}

	return this.contentBox(taxon, coord, box);
};

EOLTreeMap.prototype.contentBox = function(taxon, coord, html) {
    var c = {};
    for(var i in coord) c[i] = coord[i] + "px";
	
	//add taxon background color to outermost content box
	var backgroundColor = this.config.Color.allow && this.setColor(taxon);
	if(backgroundColor) c['background-color'] = backgroundColor;
	
    return "<div class=\"content selectable\" style=\"" + this.toStyle(c) 
       + "\" id=\"" + taxon.id + "\">" + html + "</div>";
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

    if (json.nameAccordingTo) {
    	var shortClassificationName = jQuery.grep(this.tree.children, function (classification){return classification.name == json.nameAccordingTo[0]})[0].id;
    	breadcrumbs += " > ";
    	breadcrumbs += "<a class='breadcrumb ancestor selectable' href='#" + shortClassificationName + "' id='" + shortClassificationName + "'>" + shortClassificationName + "</a>";
    }
    
    //add the ancestors
    if (json.ancestors) {
	    jQuery.each(json.ancestors, function (index, ancestor) {
			breadcrumbs += " > ";
	    	breadcrumbs += "<a class='breadcrumb ancestor selectable' href='#" + ancestor.taxonID + "' id='" + ancestor.taxonID + "'>" + ancestor.scientificName + "</a>";
	    });
    }
	breadcrumbs += " > ";
	
	//wrap the ancestors and their brackets > in a span so they can be styled as a group
	breadcrumbs = "<span class='breadcrumb ancestors'>" + breadcrumbs + "</span>";
    
    //add the current node as a link out to EOL
    if (json.taxonConceptID) {
    	breadcrumbs += "<a class='breadcrumb current selectable' target='_blank' href='http://www.eol.org/" + json.taxonConceptID + "' id='" + json.id + "'>" + json.name + "</a>";
    } else if (json.id != "HOME") {
    	breadcrumbs += "<span class='breadcrumb current'>" + json.name + "</span>";
    }
    
    breadcrumbs = "<span class='breadcrumbs'>" + breadcrumbs + "</span>";
    
    return "<div class=\"head\" style=\"" + this.toStyle(c) + "\">" + breadcrumbs + "</div>";
};

EOLTreeMap.prototype.isDisplayLeaf = function (taxon) {
	return taxon.leaf() || this.atMaxDisplayDepth(taxon);
};

EOLTreeMap.prototype.atMaxDisplayDepth = function (taxon) {
	return taxon.getDepth() - this.shownTree.getDepth() >= this.controller.levelsToShow;
};

EOLTreeMap.prototype.currentHierarchyName = function () {
	if (this.shownTree) {
		if (this.shownTree.nameAccordingTo) {
			return this.shownTree.nameAccordingTo[0];
		} else {
			return this.shownTree.name; //nameAccordingTo at the root of a classification is just the name of that classification
		}
	}
	
	return null;
}

/* Minor edit of processChildrenLayout to sort equal-area nodes alphabetically */
EOLTreeMap.prototype.processChildrenLayout = function (par, ch, coord) {
	//compute children real areas
	var parentArea = coord.width * coord.height;
	var i, totalChArea = 0, chArea = [];
	for (i = 0; i < ch.length; i++) {
		chArea[i] = parseFloat(ch[i].getArea());
		totalChArea += chArea[i];
	}
	for (i = 0; i < chArea.length; i++) {
		ch[i]._area = parentArea * chArea[i] / totalChArea;
	}
	var minimumSideValue = (this.layout.horizontal())? coord.height : coord.width;
	
	//kgu: sorting by area (required for treemap), then name. In case all of the areas are the same, we might as well have alpha order
	ch.sort(function (a, b) {
		var diff = a._area - b._area;
		return diff || a.name.localeCompare(b.name);
	});
	
	var initElem = [ch[0]];
	var tail = ch.slice(1);
	this.squarify(tail, initElem, minimumSideValue, coord);
};

/**
 * overriding setColor to use Taxon.getColor()
 */
EOLTreeMap.prototype.setColor = function(taxon) {
    var c = this.config.Color,
    maxcv = c.maxColorValue,
    mincv = c.minColorValue,
    maxv = c.maxValue,
    minv = c.minValue,
    diff = maxv - minv,
    x = (taxon.getColor() - 0);
	
	//if the value range has just one value, return the min color
	if (diff === 0) {
		return EOLTreeMapController.$rgbToHex(c.minColorValue);
	}
	
	//clamp x to range [minv,maxv]
	x = Math.max(x, minv);
	x = Math.min(x, maxv);
	
    //linear interpolation    
    var comp = function(i, x) { 
      return colorValue = Math.round((((maxcv[i] - mincv[i]) / diff) * (x - minv) + mincv[i])); 
    };
    
    return EOLTreeMapController.$rgbToHex([ comp(0, x), comp(1, x), comp(2, x) ]);
};

///** Overriding TM.Squarified.compute to account for border width when sizing children*/
EOLTreeMap.prototype.compute = function(json, coord) {
  	coord.width -= 2 * this.controller.borderWidth;
	coord.height -= 2 * this.controller.borderWidth;
	
    if (!(coord.width >= coord.height && this.layout.horizontal())) 
      this.layout.change();
    var ch = json.children, config = this.config;
    if(ch.length > 0) {
      this.processChildrenLayout(json, ch, coord);
      for(var i=0; i<ch.length; i++) {
        var chcoord = ch[i].coord,
        offst = config.offset,
        height = chcoord.height - (config.titleHeight + offst),
        width = chcoord.width - offst;
        coord = {
          'width':width,
          'height':height,
          'top':0,
          'left':0
        };
        this.compute(ch[i], coord);
      }
    }
};

/*
 * Loads missing nodes in a subtree to a given depth.  
 * Nodes at depth will be fetched from the api, but their children will be id-only placeholders (will not have children or data)
 */
EOLTreeMap.loadSubtrees = function (subtree, controller, depth, onComplete) {
	onComplete = onComplete || controller.onComplete;
	if (depth < 0) {
		onComplete();
		return;
	} else if (depth === undefined) {
		depth = controller.levelsToShow;	
	} 
	
	if (!subtree.children || subtree.children.length === 0) {
		
		//this node has not loaded children - do controller.request() to fetch the subtree
		controller.request(subtree.id, depth, {onComplete: function(nodeId, fetchedSubtree){
			subtree.merge(fetchedSubtree);
			onComplete();
		}});

	} else {
		
		//this node has children.  recurse and call onComplete once we've heard back from all of them
		var childrenToCallback = subtree.children.length;
		jQuery(subtree.children).each(function(i, child) {
			TreeUtil.loadSubtrees(child, controller, depth - 1, function () {
				childrenToCallback -= 1;
				if (childrenToCallback === 0) {
					onComplete();
				}
			});
		});
	}
};


