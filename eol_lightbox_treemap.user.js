// ==UserScript==
	// @name		EOL lightbox treemap
	// @namespace	        
	// @description	        
	// @include		http://eol.org/pages/*
	// @include		http://www.eol.org/pages/*
	// @require		http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
	// @require		http://swip.codylindley.com/jquery.DOMWindow.js
	// @require		http://thejit.org/Jit/jit-yc.js
// ==/UserScript==
alert("Starting treemap script");
console.log("Starting treemap script");

//prepdom.js
$(document).ready(function() {
	//This should all be changes that would be made to the html to accomodate the new visualization
	
	$("#browser-text").after("<div id='lightbox'><div id='thejit' ></div></div>");
	
	showVis();
	
	$("#textarea > a").after("<a id='jitlink' href='#lightbox'>JIT</a>");
	$("#jitlink").openDOMWindow({ 
		eventType:'click',
		width: 800,
        height: 600,
		windowPadding: 0
	}); 
	$('#lightbox').hide();
	
});

//texthtmltree.js
function TextHTMLTree(html, prependAncestors) {
	prependAncestors = prependAncestors !== undefined ? prependAncestors : false;

	if (prependAncestors) {
		//root at a dummy node, parent of all kingdoms
		this.id = 0;
		this.name = "Life";
		this.data = {};
		this.children = [];
		
		//add the kingdom subtrees
		var tree = this;
		GM_log(jQuery('> ul > li', html));
		jQuery('> ul > li', html).each(function() { //this selector does not seem to work in Firefox
			tree.children.push(TextHTMLTree.prototype.getSubtree(this));
		});
		
	} else {
		//root at the current node
		var lastone = TextHTMLTree.prototype.getSubtree(jQuery('li.lastone',html)[0]);
		this.id = lastone.id;
		this.name = lastone.name;
		this.data = lastone.data;
		this.children = lastone.children;
	}
	
	console.log("transformed tree: ");
	console.log(this);
}


/* 
 * Gets a subtree using some html <li> element from http://eol.org/navigation/show_tree_view/[id]
 * html is expected to be the <li> element of the desired root node
 */
TextHTMLTree.prototype.getSubtree = function(html) {
	var currentNode = jQuery('> span a:first',html); //this selector does not seem to work in Firefox
	var href = currentNode.attr('href');
	var node = {
		data: {
			path: href,
			$area: 1
		},
		id: href.replace("/pages/", ""),
		name: currentNode.text(), //TODO this will include the attribution of the name for species nodes (" Linnaeus, 1758").  Keep it?
		
		children: []
	}

	//loop through the children and add them
	jQuery('> ul > li, > div > ul > li', html).each(function() {
		node.children.push(TextHTMLTree.prototype.getSubtree(this));
	});
	
	//if (node.children.length > 0) {
	//	node.data.$area = 0;
	//}
	
	return node;
}

//vis.js
showVis = function() {
	console.log('transforming tree');
	var tree = new TextHTMLTree(jQuery('#taxonomic-text-container')[0], true);
	console.log('displaying tree');
	show(tree);
}

show = function(tree){

    var infovis = document.getElementById('thejit');
    var w = infovis.offsetWidth, h = infovis.offsetHeight;
    //infovis.style.width = w + 'px';
    //infovis.style.height = h + 'px';
	infovis.style.width = '800px';
    infovis.style.height = '600px';
    
    //init tm
    var tm = new TM.Squarified({
		levelsToShow:1,
	
        //Where to inject the treemap.
        rootId: 'thejit',

        //Add click handlers for
        //zooming the Treemap in and out
        addLeftClickHandler: true,
        addRightClickHandler: true,
        
        //When hovering a node highlight the nodes
        //between the root node and the hovered node. This
        //is done by adding the 'in-path' CSS class to each node.
        selectPathOnHover: true,
        
        //Allow tips
        Tips: {
          allow: true,
          //add positioning offsets
          offsetX: 20,
          offsetY: 20,
          //implement the onShow method to
          //add content to the tooltip when a node
          //is hovered
          onShow: function(tip, node, isLeaf, domElement) {
              tip.innerHTML = "<div class=\"tip-title\">" + node.name + "</div>" + 
                "<div class=\"tip-text\" id='tip-text'></div>"; 
			  if (node.imageURL) {
				$("#tip-text").append("<img src='" + node.imageURL + "'></img>");
			  }
			  if (node.description) {
				$("#tip-text").append(node.description);
			  }
			  
          },  

        },

        //Remove all element events before destroying it.
        onDestroyElement: function(content, tree, isLeaf, leaf){
            if(leaf.clearAttributes) leaf.clearAttributes();
        },
		
		onCreateElement:  function(content, node, isLeaf, head, body) {  
			//TODO calculate the actual host name (eol.org or www.eol.org), or try using just path as URL, to avoid same-origin problems
			if (node.id === 0) {
				return;
			}
			
			head.innerHTML += " <a id='page-link' href=" + node.data.path + "><img alt='eol page' src='/images/external_link.png'></a>";
			//$(head).after(" <a class='closeDOMWindow' href=" + node.data.path + "><img alt='eol page' src='/images/external_link.png'></a>");
			
			var textType = "GeneralDescription";
			
			console.log("getting tooltip for " + node.id);
			var url = "http://www.eol.org/api/pages/" + node.id + "?images=1&subject=" + textType;
			console.log(url);
			jQuery.get( url, 
				function(apiResponse) {
					var imageObjectURL = jQuery("dataType:contains('StillImage')", apiResponse).prev().text(); //hack because jQuery won't select dc:identifier
					if (imageObjectURL.length > 0) {
						imageObjectURL = "http://www.eol.org/api/data_objects/" + imageObjectURL;
						console.log("image object url: " + imageObjectURL);
						
						jQuery.get( imageObjectURL, function(object) {
							//pick the first mediaURL element
							node.imageURL = jQuery("mediaURL:first",object).text();
							if (isLeaf) {
								head.innerHTML += "<div><img src='" + node.imageURL + "' height=100%></img><div>";
							}
							console.log("image url: " + node.imageURL);
						}, 'xml');
					}
					
					var descriptionObjectURL = jQuery("subject:contains('" + textType + "')", apiResponse).prev().prev().text(); //hack because jQuery won't select dc:identifier
					if (descriptionObjectURL.length > 0) {
						descriptionObjectURL = "http://www.eol.org/api/data_objects/" + descriptionObjectURL;
						console.log("description object url: " + descriptionObjectURL);
						
						jQuery.get( descriptionObjectURL, function(object) {
							node.description = jQuery("description",object).text();
						}, 'xml');
					}
				}, 'xml'
			);
		},
		
		request: function(nodeId, level, onComplete) {
			var url = "http://www.eol.org/navigation/show_tree_view/" + nodeId;
			jQuery.get( url, function(data) {
				var tree = new TextHTMLTree(data, false);
				onComplete.onComplete(nodeId, tree);
			});
		},
    });
	
	//TM.Squarified.implement({  
	//	'onLeftClick': function(elem) {  
	//		alert('left click');  
	//	}  
	//}); 
    
    //load tree and plot
    tm.loadJSON(tree);
    //end
}