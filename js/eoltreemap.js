function EOLTreeMap(container) {
	var that = this;
	this.rootId = container.id;
	jQuery(container).addClass("treemap-container");
	
	var controller = new EOLTreeMapController(container.id);
	this.initialize({"rootId":controller.rootId, "Tips":controller.Tips});
	this.controller = this.config = controller; //JIT's TM.initialize() uses $merge() which breaks my controller's binding to its options form
	
	this.api = new EolApi();
	this.controller.api = this.api;
	
	/** 
	 * returns new custom taxon objects instead of hierarchy_entries objects
	 * Also, does a second api call to get iucn data
	 */
	this.api.fetchNode = function (taxonID, onSuccess) {
		this.hierarchy_entries(taxonID, function (json) {
			var taxon = new Taxon(json);
			
			if (taxon.taxonRank == "Species" || taxon.taxonRank == "Subspecies" || taxon.children.length == 0) {
				that.api.getIucnStatus(taxon, function(iucn){
					taxon.iucn = iucn;
					onSuccess(taxon);
				});
			} else {
				onSuccess(taxon);
			}
		});
	};

	TreeUtil.loadSubtrees = EOLTreeMap.loadSubtrees; //override TreeUtil.loadSubtrees with mine
	TreeUtil.getSubtree = EOLTreeMap.getSubtree; //override TreeUtil.getSubtree with mine
	
	this.nodeSelectHandlers = [];
	this.viewChangeHandlers = [];
	this.selectionFrozen = false;
	
	/* Add mouse and keyboard event handlers */
	jQuery(".selectable")
		.live("mouseout", function() {
			that.select(null);
			return false;
		})
		.live("mouseover", function() {
			that.select(this.id);
			return false;
		});
	
	jQuery("div.content, a.breadcrumb.ancestor").live("click", function() {
		window.location.hash = this.id;
		return false;
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
	
	// some form element changes trigger a refresh
	jQuery(form).change(function(eventObject) {
		switch(eventObject.target.id) {
			case "displayImages": 
				break;
			default: 
				that.view(that.shownTree.id); 
				break;
		}
		
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
	id = id || this.shownTree.id; //default to refreshing the current view
	
	//show a progress pointer and overlay a tinted div on the current view
	var rootElement = jQuery("#" + this.rootId);
	rootElement.css("cursor", "progress");
	jQuery("<div class='transparent overlay'>").appendTo(rootElement).width(rootElement.innerWidth()).height(rootElement.innerHeight());
	
    /* JIT leaves the layout orientation set to whatever it was at the
     * end of the last draw, which sometimes makes the layout alternate between 
     * horizontal and vertical on successive refreshes of the same node, so I'm
     * resetting it here.
     */ 	
	this.layout.orientation = this.config.orientation;
	var that = this;

	post = jQuery.extend({}, this.controller);
	post.onComplete = function() {
		that.shownTree = TreeUtil.getSubtree(that.tree, id);
		that.loadTree(id);
		jQuery("<img class='freeze-indicator' src='images/Snowflake-black.png'>").appendTo("#" + that.rootId).hide();
		jQuery.each(that.viewChangeHandlers, function(index, handler) {
			handler(that.shownTree);
		});
		
		//clean up wait indicators
		rootElement.css("cursor", "auto");
		jQuery("div.overlay", rootElement).remove();
	};
	
	this.ensureNode(id, function (node) {
		TreeUtil.loadSubtrees(node, post, that.controller.levelsToShow);
	});
};

EOLTreeMap.prototype.ensureNode = function (id, callback) { 
	var that = this;
	
	if (!this.tree) {
		this.stump(function (tree) {
			that.tree = tree;
			that.ensureNode(id, callback);
		});
	} else {
		var node = TreeUtil.getSubtree(this.tree, id);
		
		if (!node) {
			this.api.fetchNode(id, function (json) {
				that.graft(that.tree, json, function (newNode) {
					callback(newNode);
				});
			});
		} else {
			callback(node);
		}
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

EOLTreeMap.prototype.stump = function (onSuccess) {
	var that = this;
	
	var tree = new Taxon(null, "HOME", "Classifications");
	tree.apiContentFetched = true; //make sure we don't try to do EOL API calls for the root
	tree.children = [];
	
	this.api.provider_hierarchies(function (response) {
		var hierarchiesToFetch = response.length;
		
		jQuery.each(response, function (index, hierarchy) {
			that.api.hierarchies(hierarchy.id, function (hierarchyResponse) {
				var metadata = EOLTreeMap.hierarchies[hierarchy.id];
				var id = metadata ? metadata.short : "hierarchy" + hierarchy.id;

				hierarchy.children = hierarchyResponse.roots; 
				var node = new Taxon(hierarchy, id, hierarchy.label);
				
				node.image = {mediaURL:"images/tree_icon.svg"};
				
				if (metadata) {
					node.image = metadata.image;
					node.text = metadata.text;
				}

				node.apiContentFetched = true;
				tree.children.push(node);
				
				hierarchiesToFetch--;
				if (hierarchiesToFetch < 1) {
					tree.setAsParent();
					onSuccess(tree);
				}
			});
		});
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

EOLTreeMap.help = "<div class='help'><h2>Instructions</h2><div><ul><li>Hover the mouse over a taxon image to see details about that taxon.  To freeze the details panel (so you can click links, select text, etc.), hold down the F key.</li>  <li>Left-click the image to view its subtaxa.</li>  <li>Left-click the underlined taxon name to go to the EOL page for that taxon.</li> <li>Left click the (non-underlined) taxon names in the 'breadcrumb trail' at the top to view supertaxa of this taxon</li> <li>Use your browser's back and next buttons, as you usually would, to see the previous or next page in your history, respectively.</li></div><p>Learn more about the project, download the source code, or leave feedback at the <a href='http://github.com/kurie/EOL-tree-viewer'>GitHub repository</a>.</p> </div>";

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
    x = taxon.getColor();
	
    //if x is already a color value, just return that
	if (EOLTreeMap.hexPattern.test(x)) {
		return x;
	}
    
	//if the value range has just one value, return the min color
	if (diff === 0) {
		return EOLTreeMapController.$rgbToHex(c.minColorValue);
	}
	
	//make x a number and clamp to range [minv,maxv]
	x = (taxon.getColor() - 0);
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
    if(ch && ch.length > 0) {
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
	
	if (!subtree.children) {
		
		//this node has not loaded children - do controller.request() to fetch the subtree
		controller.request(subtree.id, depth, {onComplete: function(nodeId, fetchedSubtree){
			subtree.merge(fetchedSubtree);
			onComplete();
		}});

	} else {
		
		//this node has children.  recurse and call onComplete once we've heard back from all of them
		var childrenToCallback = subtree.children.length;
		
		if (!childrenToCallback) {
			//FIXME figure out where childless nodes are getting empty child arrays added to them
			onComplete();
		}
		
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

EOLTreeMap.getSubtree = function(tree, id){
	if (tree.id == id) 
		return tree;
	
	if (tree.children) {
		for (var i = 0, ch = tree.children; i < ch.length; i++) {
			var t = this.getSubtree(ch[i], id);
			if (t != null) 
				return t;
		}
	}
	
	return null;
};

/* Used to test taxon color values for being a hex color string */
EOLTreeMap.hexPattern = /^#([0-9a-f]{3}){1,2}$/i;

//some more info to dress up the currently known hierarchy nodes.  (new ones will get a placeholder image but no description.)
EOLTreeMap.hierarchies = {
    529: {
		short:"COL",
		image:{mediaURL:"images/col_dvd_front_cover.jpg"},
		text:{description:"<p><b>CoL</b> <a href='http://www.catalogueoflife.org/'>http://www.catalogueoflife.org/</a><br>The Catalogue of Life Partnership (CoLP) is an informal partnership dedicated to creating an index of the world’s organisms, called the Catalogue of Life (CoL). The CoL provides different forms of access to an integrated, quality, maintained, comprehensive consensus species checklist and taxonomic hierarchy, presently covering more than one million species, and intended to cover all know species in the near future. The Annual Checklist EOL uses contains substantial contributions of taxonomic expertise from more than fifty organizations around the world, integrated into a single work by the ongoing work of the CoLP partners. EOL currently uses the CoL Annual Checklist as its taxonomic backbone.</p>"}
	},
	441: {
		short:"NCBI",
		image:{mediaURL:"images/white_ncbi.png"},
		text:{description:"<p><b>NCBI</b> <a href='http://www.ncbi.nlm.nih.gov/'>http://www.ncbi.nlm.nih.gov</a><br>As a U.S. national resource for molecular biology information, NCBI's mission is to develop new information technologies to aid in the understanding of fundamental molecular and genetic processes that control health and disease. The NCBI taxonomy database contains the names of all organisms that are represented in the genetic databases with at least one nucleotide or protein sequence.</p>"}
	},
	144: {
		short:"IUCN",
		image: {mediaURL:"images/iucn_high_res.jpg"},
		text: {description:"<p><b>IUCN</b> <a href='http://www.iucn.org//'>http://www.iucn.org/</a><br>International Union for Conservation of Nature (IUCN) helps the world find pragmatic solutions to our most pressing environment and development challenges. IUCN supports scientific research; manages field projects all over the world; and brings governments, non-government organizations, United Nations agencies, companies and local communities together to develop and implement policy, laws and best practice. EOL partnered with the IUCN to indicate status of each species according to the Red List of Threatened Species.</p>"}
	},
	143: {
		short:"FishBase",
		image: {mediaURL:"images/fblogo.jpg"},
		text: {description:"<p><b>FishBase</b> <a href='http://www.fishbase.org/'>http://www.fishbase.org/</a><br>FishBase is a global information system with all you ever wanted to know about fishes. FishBase is a relational database with information to cater to different professionals such as research scientists, fisheries managers, zoologists and many more. The FishBase Website contains data on practically every fish species known to science. The project was developed at the WorldFish Center in collaboration with the Food and Agriculture Organization of the United Nations and many other partners, and with support from the European Commission. FishBase is serving information on more than 30,000 fish species through EOL.</p>"}
	},
	627: {
		short:"ITIS",
		image:{mediaURL:"images/itis_circle_image.jpg"},
		text: {description:"<p><b>ITIS</b> <a href='http://www.itis.gov/'>http://www.itis.gov/</a><br />The Integrated Taxonomic Information System (ITIS) is a partnership of federal agencies and other organizations from the United States, Canada, and Mexico, with data stewards and experts from around the world (see http://www.itis.gov). The ITIS database is an automated reference of scientific and common names of biota of interest to North America . It contains more than 600,000 scientific and common names in all kingdoms, and is accessible via the World Wide Web in English, French, Spanish, and Portuguese (http://itis.gbif.net). ITIS is part of the US National Biological Information Infrastructure (http://www.nbii.gov).</p>"}
	},
	121: {
		short:"AntWeb",
		image:{mediaURL:"images/antweb_logo.png"},
		text: {description:"<p><b>AntWeb</b> <a href='http://www.antweb.org/'>http://www.antweb.org/</a><br />AntWeb is generally recognized as the most advanced biodiversity information system at species level dedicated to ants. Altogether, its acceptance by the ant research community, the number of participating remote curators that maintain the site, number of pictures, simplicity of web interface, and completeness of species, make AntWeb the premier reference for dissemination of data, information, and knowledge on ants. AntWeb is serving information on tens of thousands of ant species through the EOL.</p>"}
	},
	123: {
		short:"WoRMS",
		image:{mediaURL:"images/wormsbanner1.jpg"},
		text: {description:"<p><b>WoRMS</b> <a href='http://www.marinespecies.org/'>http://www.marinespecies.org/</a><br />The aim of a World Register of Marine Species (WoRMS) is to provide an authoritative and comprehensive list of names of marine organisms, including information on synonymy. While highest priority goes to valid names, other names in use are included so that this register can serve as a guide to interpret taxonomic literature.</p>"}
	},
	596: {
		short:"Index Fungorum",
		image:{mediaURL:"images/LogoIF.gif"},
		text: {description:"<p><b>Index Fungorum</b> <a href='http://www.indexfungorum.org/'>http://www.indexfungorum.org/</a><br />The Index Fungorum, the global fungal nomenclator coordinated and supported by the Index Fungorum Partnership (CABI, CBS, Landcare Research-NZ), contains names of fungi (including yeasts, lichens, chromistan fungal analogues, protozoan fungal analogues and fossil forms) at all ranks. </p>"}
	},
	640: {
		short:"Metalmark",
		image:{mediaURL:"http://content7.eol.org/content/2010/07/13/04/52919_large.jpg"},
		text: {description:"<p><b>Metalmark Moths of the World</b> <a href='http://choreutidae.lifedesks.org/'>http://choreutidae.lifedesks.org/</a><br />Metalmark moths (Lepidoptera: Choreutidae) are a poorly known, mostly tropical family of microlepidopterans.  The Metalmark Moths of the World LifeDesk provides species pages and an updated classification for the group.</p>"}
	}
}

		
