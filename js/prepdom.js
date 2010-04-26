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