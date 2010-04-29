"use strict";
var jQuery, TextHTMLTree, TM;

function EOLTreeMap(container) {

	jQuery("<div id='thejit' ></div>").appendTo(container);
	jQuery("<div id='jitdetail' ></div>").appendTo(container);
	var tree = new TextHTMLTree(jQuery('#taxonomic-text-container')[0], true);

	console.log("Starting tree viewer");

    var tm = new TM.Squarified({
		levelsToShow: 1,
        rootId: 'thejit',
        addLeftClickHandler: true,
        addRightClickHandler: true,
        selectPathOnHover: true,
		orientation:"v",
		titleHeight:22,

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
			
			//add the link out to the EOL page
			if (node.data.path) {	
				jQuery("<a class='page-link' href=" + node.data.path + "><img alt='eol page' src='/images/external_link.png'></a>").prependTo(head);
			}				

			EOLTreeMap.getAPIData(node, function () {
				if (isLeaf && node.imageURL) {
					jQuery(head).wrapInner("<div class='title'></div>");
				
					var image = jQuery("<img class='node' src='" + node.imageURL + "'></img>");
					image.load(function handler(eventObject) {
						var imageAR = image[0].width/image[0].height;
						var containerAR = node.coord.width/(node.coord.height - 25);
						
						if (imageAR >= containerAR) {
							//fit height
							image[0].height = node.coord.height - 25;
						} else {
							//fit width
							image[0].width = node.coord.width;
						}
					});
					
					image.appendTo(head);
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
    
    tm.loadJSON(tree);
	//tm.view(tree.currentNodeId); //FIXME
}

EOLTreeMap.getDetail = function (node) {
	var tooltipHtml = "<div class=\"tip-title\">" + node.name + "</div>" + 
		"<div class=\"tip-text\" id='tip-text'></div>"; 
	if (node.imageURL) {
		tooltipHtml += "<img src='" + node.imageURL + "'></img>";
	}
	if (node.description) {
		tooltipHtml += node.description;
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
			node.imageURL = jQuery("dataType:contains('StillImage')", apiResponse).siblings('mediaURL:first').text();
			node.description = jQuery("dataObject:has(subject:contains('" + textType + "')) description", apiResponse).text();
			callback();
		}, 'xml'
	);
};

TreeUtil.loadAllChildren = function (tree, controller, callback) {

	if (tree.id === 0 || tree.data.childrenFetched) {
		callback();
	} else {
		controller.request(tree.id, 0, {
			onComplete: function(nodeId, subtree) {
				for (child in subtree.children) {
					if (!tree.children.containsID(subtree.children[child].id)) {
						tree.children.push(subtree.children[child]);
					}
				}
				tree.data.childrenFetched = true;
				callback();
			}
		});
	}
};


//a hack of the JIT's TreeUtil to fix the current node's ancestor-siblings not loading.
TreeUtil.loadSubtrees = function (tree, controller) {
	//first, make sure the children of the root are all loaded
	this.loadAllChildren(tree, controller, function () {

		var maxLevel = controller.request && controller.levelsToShow;
		var leaves = TreeUtil.getLeaves(tree, maxLevel),
		len = leaves.length,
		selectedNode = {};
		if(len == 0) controller.onComplete();
		for(var i=0, counter=0; i<len; i++) {
			var leaf = leaves[i], id = leaf.node.id;
			selectedNode[id] = leaf.node;
			controller.request(id, leaf.level, {
				onComplete: function(nodeId, tree) {
					var ch = tree.children;
					selectedNode[nodeId].children = ch;
					if(++counter == len) {
						controller.onComplete();
					}
				}
			});
		}
	});
};

  /*
	Modifying the layout to sort equal-area nodes alphabetically

        par - The parent node of the json subtree.  
        ch - An Array of nodes
      coord - A coordinates object specifying width, height, left and top style properties.
  */
TM.Squarified.prototype.processChildrenLayout = function (par, ch, coord) {
	//compute children real areas
	var parentArea = coord.width * coord.height;
	var i, totalChArea=0, chArea = [];
	for(i=0; i < ch.length; i++) {
		chArea[i] = parseFloat(ch[i].data.$area);
		totalChArea += chArea[i];
	}
	for(i=0; i<chArea.length; i++) {
		ch[i]._area = parentArea * chArea[i] / totalChArea;
	}
	var minimumSideValue = (this.layout.horizontal())? coord.height : coord.width;
	ch.sort(this.sortComparator);
	var initElem = [ch[0]];
	var tail = ch.slice(1);
	this.squarify(tail, initElem, minimumSideValue, coord);
};

TM.Squarified.prototype.sortComparator = function (a, b) {
	var diff = a._area - b._area;
	return diff || a.name.localeCompare(b.name);
};
	
Array.prototype.containsID = function (id) {
		for (i in this) {
			if (this[i].id === id) return true;
		}
		return false;
};
