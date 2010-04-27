"use strict";
var jQuery, TextHTMLTree, TM;

function EOLTreeMap(container) {

	jQuery("<div id='thejit' ></div>").width('100%').height('100%').appendTo(container);
	var tree = new TextHTMLTree(jQuery('#taxonomic-text-container')[0], true);

	console.log("Starting tree viewer");

    var tm = new TM.Squarified({
		levelsToShow: 1,
        rootId: 'thejit',
        addLeftClickHandler: true,
        addRightClickHandler: true,
        selectPathOnHover: true,
        
        Tips: {
			allow: true,
			offsetX: 20,
			offsetY: 20,

			onShow: function (tip, node, isLeaf, domElement) {
				tip.innerHTML = EOLTreeMap.getTooltip(node);
			}  
        },

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
				head.innerHTML += " <a id='page-link' href=" + node.data.path + "><img alt='eol page' src='/images/external_link.png'></a>";	
			}				

			EOLTreeMap.getAPIData(content, node, isLeaf, head, body);
		},
		
		request: function (nodeId, level, onComplete) {
			var url = "/navigation/show_tree_view/" + nodeId;
			jQuery.get(url, function (data) {
				var tree = new TextHTMLTree(data, false);
				onComplete.onComplete(nodeId, tree);
				//todo use jQuery.ajax and add a error handler that just calls onComplete, then consider getting rid of the top 'if' in loadAllChildren
			});
		}
    });
    
    tm.loadJSON(tree);
}

EOLTreeMap.getTooltip = function (node) {
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

EOLTreeMap.getAPIData = function (content, node, isLeaf, head, body) {
	if (node.imageURL || node.description) {
		//return if API data already fetched
		return;
	}

	//get the tooltip content from the API
	var textType = "GeneralDescription";
	
	console.log("getting tooltip for " + node.id);
	var url = "/api/pages/" + node.id + "?images=1&subject=" + textType;
	console.log(url);
	jQuery.get(url, 
		function (apiResponse) {
			var imageObjectURL = jQuery("dataType:contains('StillImage')", apiResponse).prev().text(); //hack because jQuery won't select dc:identifier
			if (imageObjectURL.length > 0) {
				imageObjectURL = "/api/data_objects/" + imageObjectURL;
				console.log("image object url: " + imageObjectURL);
				
				jQuery.get(imageObjectURL, function (object) {
					//pick the first mediaURL element
					node.imageURL = jQuery("mediaURL:first", object).text();
					if (isLeaf) {
						head.innerHTML += "<div><img src='" + node.imageURL + "' height=100%></img><div>";
					}
					console.log("image url: " + node.imageURL);
				}, 'xml');
			}
			
			var descriptionObjectURL = jQuery("subject:contains('" + textType + "')", apiResponse).prev().prev().text(); //hack because jQuery won't select dc:identifier
			if (descriptionObjectURL.length > 0) {
				descriptionObjectURL = "/api/data_objects/" + descriptionObjectURL;
				console.log("description object url: " + descriptionObjectURL);
				
				jQuery.get(descriptionObjectURL, function (object) {
					node.description = jQuery("description", object).text();
				}, 'xml');
			}
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
}


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
}

	
Array.prototype.containsID = function (id) {
		for (i in this) {
			if (this[i].id === id) return true;
		}
		return false;
}
