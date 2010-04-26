showVis = function() {
	var tree = new TextHTMLTree(jQuery('#taxonomic-text-container')[0], true);
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