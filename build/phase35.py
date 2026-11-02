# Health check fix for phase34 (iPhone/iPad home-screen app). Applied after phase34.py.
# On iOS, pinch-zoom shrinks innerHeight too, so a zoomed-in page looked like a "keyboard shrink":
# the bottom bar was pushed down by hundreds of px and every zoom step logged a new lag event.
# Treat a zoomed page as not shrunk, and log a real shrink at most once every 10 minutes.
rep('  const short = () => maxH[key()] - innerHeight;', '  const short = () => zoomed() ? 0 : maxH[key()] - innerHeight;')
rep('  const note = () => { if(!typing()) maxH', '  const zoomed = () => !!window.visualViewport && visualViewport.scale > 1.01;\n  const note = () => { if(!typing() && !zoomed()) maxH')
rep('if(short()>4) track("lag",{where:"iOS keyboard shrink "+Math.round(short())+"px",ms:0});',
    'if(short()>4 && Date.now()-(heal.t||0)>600000){ heal.t=Date.now(); track("lag",{where:"iOS keyboard shrink "+Math.round(short())+"px",ms:0}); }')
