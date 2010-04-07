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


// {
	// //This should all be changes that would be made to the html to accomodate the new visualization
	
	// $("#browser-text").after("<div id='thejit' style='display:none;'></div>");

	// // $("#textarea > a:first-child + a").removeAttr("onclick").attr("href","#thejit").openDOMWindow({ 
		// // eventType:'click',
		// // width: 800,
        // // height: 600
	// // }); 

	// $("#browser-text").before(' <a href="#thejit">JIT</a> ').openDOMWindow({ 
		// eventType:'click',
		// width: 800,
        // height: 600
	// }); 

// }