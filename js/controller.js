function EOLTreeMapController() {
	this.levelsToShow = 1; //number of levels to show at once
	this.titleHeight = 22; //taxon name container height
	this.offset = 2; //controls the thickness of container borders
	this.minFontSize = 10; //taxon names will shrink to fit until they reach this size
			
	this.Color = {
		allow: false,
		minValue: 0,
		maxValue: 1,
		minColorValue: [0, 0, 0],
		maxColorValue: [192, 192, 192]
	};
	
	this.optionsForm = EOLTreeMapController.bindOptionsForm(this);
}

EOLTreeMapController.prototype.onDestroyElement = function (content, tree, isLeaf, leaf) {
	if (leaf.clearAttributes) { 
		//Remove all element events before destroying it.
		leaf.clearAttributes(); 
	}
};

EOLTreeMapController.prototype.onCreateElement = function (content, node, isLeaf, head, body) {  
	if (!node) {
		return;
	}
	
	//if page API content not loaded, get that first and then call this method again
	var that = this;
	if (!node.apiContentFetched) {
		this.api.decorateNode(node, function () {
			node.apiContentFetched = true;
			that.onCreateElement(content, node, isLeaf, head, body);
		});
	}
	
	//ignore isLeaf parameter, JIT.each is wrong about this.  Use this.isLeafElement(content)
	if (!this.Color.allow && this.isLeafElement(content)) {
		if (node.apiContentFetched) {
			this.insertBodyContent(node, body);
		} else {
			var placeholder = new Image();
			placeholder.src = "images/ajax-loader.gif";
			jQuery(body).html(placeholder);
		}
	}
};

EOLTreeMapController.prototype.onAfterCompute = function (tree) {
	/*
	 * Adding these elements to the tree in the plotting (createBox, etc...) 
	 * functions or in onCreateElement breaks the tree traversal in 
	 * initializeElements, so I have to add them here
	 */
	
	//Wrap an EOL link around all head divs and a navigation hash link around all of the body divs
	var that = this;
	jQuery("#" + tree.id).find("div .content").each(function (index, element) {
		var node = TreeUtil.getSubtree(tree, this.id);
		
		if (node) {
			var body = jQuery(this).children()[1];
			var head = null;
			
			if (body) {
				head = jQuery(this).children()[0];
			} else {
				body = jQuery(this).children()[0];
				head = jQuery(body).contents()[0];
			}
			
			if (head && node.taxonConceptID) {
				jQuery(head).wrap("<a class='head' target='_blank' href=http://www.eol.org/" + node.taxonConceptID + "></a>");
			}
			
			if (body) {
				jQuery(body).wrap("<a class='body' href=#" + node.id + "></a>");
			}

		}
	});
	
	jQuery(".treemap-container > div.content div.content > a.head > div.head").each(function (index, element) {
		var fontsize = jQuery(this).css("font-size").replace("px","");
		while(this.scrollWidth > this.offsetWidth && fontsize > that.minFontSize) {
			fontsize -= 1;
			jQuery(this).css("font-size", fontsize + "px");
		}
	});
}

EOLTreeMapController.prototype.request = function (nodeId, level, onComplete) {
	var controller = this;
	this.api.fetchNode(nodeId, function (json) {
		
		if (level > 0 && json.children && json.children.length > 0) {
			var childrenToCallBack = json.children.length;
			
			jQuery(json.children).each(function (i, child) {
				controller.request(child.taxonID, level - 1, {onComplete: function (id, childJSON){
					child.merge(childJSON);
					childrenToCallBack -= 1;
					if (childrenToCallBack === 0) {
						onComplete.onComplete(nodeId, json);
					}
				}});
			});
		} else {
			onComplete.onComplete(nodeId, json);
		}
	});
};

EOLTreeMapController.prototype.insertBodyContent = function (node, container) {
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
		jQuery(container).html("No image available.<p><a href='http://www.eol.org/content/page/help_build_eol' target='_blank'>Click here to help EOL find one.</a></p>");
	}

};

EOLTreeMapController.prototype.insertImage = function (image, container, callback) {
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
			jQuery(container).html("There was an error loading this image.");
			callback();
		});
	}
};

EOLTreeMapController.prototype.isLeafElement = function(element) {
	var jqElement = jQuery(element);
	return jqElement.children('div').length <= 1 || jqElement.children('div').length === 2 && jqElement.children('div')[1].children.length === 0;
}

//EOLTreeMapController.prototype.getOptionsForm = function () {
//	var form = jQuery("<form name='treemap' onsubmit='return false;'>");
//	
//	var depth = jQuery("<input type='text' name='depth' size=3>");
//	depth.val(this.controller.levelsToShow);
//	jQuery("<div>").append("Maximum depth: ").append(depth).appendTo(form);
//	
//	var showImages = jQuery("<input type='checkbox' name='images'>");
//	showImages[0].checked = !this.controller.Color.allow;
//	jQuery("<div>").append("Display images: ").append(showImages).appendTo(form);
//	
//	var colorRange = jQuery("<fieldset>").append("<legend>Color mapping</legend>");
//	
//	var variableList = jQuery("<select name='variable'>").appendTo(colorRange);
//	variableList.append("<option value='total_descendants'>Descendants</option>");
//	variableList.append("<option value='total_descendants_with_text'>Descendants w/text</option>");
//	variableList.append("<option value='total_descendants_with_images'>Descendants w/images</option>");
//	variableList.append("<option value='total_trusted_text'>Text (trusted)</option>");
//	variableList.append("<option value='total_unreviewed_text'>Text (unreviewed)</option>");
//	variableList.append("<option value='total_trusted_images'>Images (trusted)</option>");
//	variableList.append("<option value='total_unreviewed_images'>Images (unreviewed)</option>");
//	
//	var minValue = jQuery("<input type='text' name='minValue' size=4>");
//	var maxValue = jQuery("<input type='text' name='maxValue' size=4>");
//	var minColor = jQuery("<input class='color' size=6>");
//	var maxColor = jQuery("<input class='color' size=6>");
//	minValue.val(this.config.Color.minValue);
//	maxValue.val(this.config.Color.maxValue);
//	minColor.val(EOLTreeMap.$rgbToHex(this.config.Color.minColorValue));
//	maxColor.val(EOLTreeMap.$rgbToHex(this.config.Color.maxColorValue));
//	jQuery("<div>").append("Variable value min: ").append(minValue).append("max: ").append(maxValue).appendTo(colorRange);
//	jQuery("<div>").append("Color min: ").append(minColor).append("max: ").append(maxColor).appendTo(colorRange);
//	
//	form.append(colorRange);
//	
//	var that = this;
//	var changeHandler = function () {
//		//TODO validate
//		that.controller.Color.allow = !showImages[0].checked;
//		that.controller.levelsToShow = parseInt(depth.val()); 
//		
//		that.config.Color.minValue = minValue.val();
//		that.config.Color.maxValue = maxValue.val();
//		that.config.Color.minColorValue = jQuery.map(minColor[0].color.rgb, mapTo255);
//		that.config.Color.maxColorValue = jQuery.map(maxColor[0].color.rgb, mapTo255);
//
//		Taxon.prototype.getColor = function(){
//			return this[variableList.val()] || 0;
//		}
//
//		that.view(null);
//		return false;
//	};
//	
//	jQuery("input", form).change(changeHandler);
//	jQuery("select", form).change(changeHandler);
//	jQuery(form).submit(changeHandler);
//	
//	return form;
//};

EOLTreeMapController.bindOptionsForm = function (controller) {
	var form = jQuery(EOLTreeMapController.optionsForm);
	
	/** helper function to map a color value from [0,1] to [0,255] */
	var mapTo255 = function(colorValue) {
		return colorValue * 255;
	};
	
	//add some colorable variables to the select list
	var variableList = jQuery("#colorVariable", form);
	variableList.append("<option value='total_descendants'>Descendants</option>")
		.append("<option value='total_descendants_with_text'>Descendants w/text</option>")
		.append("<option value='total_descendants_with_images'>Descendants w/images</option>")
		.append("<option value='total_trusted_text'>Text (trusted)</option>")
		.append("<option value='total_unreviewed_text'>Text (unreviewed)</option>")
		.append("<option value='total_trusted_images'>Images (trusted)</option>")
		.append("<option value='total_unreviewed_images'>Images (unreviewed)</option>");
	
	//init values and handle changes 
	jQuery("#depth", form).val(controller.levelsToShow);
	jQuery("#depth", form).change(function() {
		controller.levelsToShow = parseInt(this.value);
	});
	
	jQuery("#displayImages", form)[0].checked = !controller.Color.allow;
	jQuery("#displayImages", form).change(function() {
		controller.Color.allow = !this.checked;
	});
	
	jQuery("#colorVariableMinValue", form).val(controller.Color.minValue);
	jQuery("#colorVariableMinValue", form).change(function() {
		controller.Color.minValue = this.value;
	});
	
	jQuery("#colorVariableMaxValue", form).val(controller.Color.maxValue);
	jQuery("#colorVariableMaxValue", form).change(function() {
		controller.Color.maxValue = this.value;
	});
	
	jQuery("#minColor", form).val(EOLTreeMapController.$rgbToHex(controller.Color.minColorValue));
	jQuery("#minColor", form).change(function() {
		controller.Color.minColorValue = jQuery.map(this.color.rgb, mapTo255);
	});
	
	jQuery("#maxColor", form).val(EOLTreeMapController.$rgbToHex(controller.Color.maxColorValue));
	jQuery("#maxColor", form).change(function() {
		controller.Color.maxColorValue = jQuery.map(this.color.rgb, mapTo255);
	});
	
	variableList.change(function() {
		Taxon.prototype.getColor = function(){
			return this[variableList.val()] || 0;
		}
	});
	
	return form;
}

EOLTreeMapController.optionsForm = "<form name='treemap' onsubmit='return false;'>" +
	"<div>Maximum depth: <input id='depth' type='text' name='depth' size='3' /></div>" +
	"<div>Display images: <input id='displayImages' type='checkbox' name='displayImages' /></div>" +
	"<fieldset><legend>Color mapping</legend>" +
	"<select id='colorVariable' name='colorVariable'></select>" + 
	"<div>Variable value min: <input id='colorVariableMinValue' type='text' name='minValue' size='4' /> max: <input id='colorVariableMaxValue' type='text' name='maxValue' size='4' /></div>" + 
	"<div>Color min: <input id='minColor' class='color' size='6' /> max: <input id='maxColor' class='color' size='6' /></div>" + 
	"</fieldset>" +
	"</form>";

EOLTreeMapController.$rgbToHex = function(srcArray, array){
    if (srcArray.length < 3) return null;
    if (srcArray.length == 4 && srcArray[3] == 0 && !array) return 'transparent';
    var hex = [];
    for (var i = 0; i < 3; i++){
        var bit = (srcArray[i] - 0).toString(16);
        hex.push((bit.length == 1) ? '0' + bit : bit);
    }
    return (array) ? hex : '#' + hex.join('');
};
