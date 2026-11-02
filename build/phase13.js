
/* ---------- Español: translates what's on screen for people who pick Spanish ---------- */
var LANG_ES = (()=>{ try{ return localStorage.getItem("lang")==="es"; }catch(e){ return false; } })();
function LOC(){ return LANG_ES ? "es-US" : "en-US"; }
const ES = {
  // navigation
  "Today":"Hoy","Tomorrow":"Mañana","Yesterday":"Ayer","Route":"Ruta","Jobs":"Trabajos","Map":"Mapa","Week":"Semana","Chat":"Chat","Clients":"Clientes","Office":"Oficina","Payouts":"Pagos","Account":"Cuenta",
  "Season Board":"Tablero de temporada","Board navigation":"Navegación",
  // route
  "Best order from shop":"Mejor orden desde el taller","Truck list":"Lista del camión","I'm hungry":"Tengo hambre","Start my day":"Empezar mi día","Auto clock-in":"Entrada automática","Auto clock-in · on":"Entrada automática · activa",
  "All crews":"Todos los equipos","Sunset":"Atardecer","Weather":"Clima","Drive":"Manejo","No truck":"Sin camión","Lunch":"Almuerzo","Lights":"Luces","Roofline":"Techo",
  "Mark done":"Marcar listo","Partly done":"Parcialmente listo","Clock in":"Marcar entrada","Clocked in":"Entrada marcada","Directions ↗":"Cómo llegar ↗","Notes & photos":"Notas y fotos","Mockup ↗":"Diseño ↗","Mockups":"Diseños",
  "Apple Maps route ↗":"Ruta en Apple Maps ↗","Google Maps route ↗":"Ruta en Google Maps ↗","Apple Maps":"Apple Maps","Google Maps":"Google Maps","Directions open in":"Abrir direcciones en",
  "Previous day":"Día anterior","Next day":"Día siguiente","Previous week":"Semana anterior","Next week":"Semana siguiente","This week":"Esta semana","Undo":"Deshacer",
  "Day ended":"Día terminado","Driving":"Manejando","At the shop":"En el taller","On a job":"En un trabajo","End day":"Terminar día","Shop":"Taller",
  "Estimated arrival, leaving the shop at 8:00 AM":"Llegada estimada, saliendo del taller a las 8:00 AM",
  // statuses and visit types
  "Install":"Instalación","Takedown":"Retiro","Service":"Servicio","Return":"Regreso","Scheduled":"Programado","Installed":"Instalado","Taken down":"Retirado","Booked":"Reservado","Quote sent":"Cotización enviada","Lead":"Prospecto","Cancelled":"Cancelado","Partly done":"Parcialmente listo",
  "✓ Done":"✓ Listo","Done":"Listo","Unassigned":"Sin asignar","No crew":"Sin equipo","No crew yet":"Sin equipo todavía","No address":"Sin dirección","No date":"Sin fecha","No stops":"Sin paradas",
  // jobs and clients
  "Active":"Activos","Needs a crew":"Necesita equipo","Needs a date":"Necesita fecha","All":"Todos","All active":"Todos activos","ProLight crews":"Equipos ProLight","ShipShape crew":"Equipo ShipShape",
  "Search name, address, TCL #, lights":"Buscar nombre, dirección, # TCL, luces","Search name, address, phone":"Buscar nombre, dirección, teléfono","Search jobs":"Buscar trabajos","Search clients":"Buscar clientes","Filter jobs":"Filtrar trabajos","Whose clients":"De quién son los clientes",
  "No jobs match.":"Ningún trabajo coincide.","Customer":"Cliente","Whose job":"De quién es","Crew":"Equipo","Status · next":"Estado · siguiente","Client":"Cliente","Address":"Dirección","Phone":"Teléfono","Access":"Acceso","Season":"Temporada","TCL target":"Meta de TCL","Priority":"Prioridad","Ready":"Listo","Visits":"Visitas","Details":"Detalles","Copy phone":"Copiar teléfono",
  "No mockups yet.":"Todavía no hay diseños.","Nothing posted yet.":"Todavía no hay nada publicado.","Report a problem":"Reportar un problema","Crews & trucks":"Equipos y camiones","Post":"Publicar","Add photo / video":"Agregar foto / video","Add photo":"Agregar foto",
  "What did you see or do? Burned-out bulbs, extra footage, customer requests…":"¿Qué viste o hiciste? Focos fundidos, pies extra, pedidos del cliente…",
  "Photos are resized automatically. Videos up to 50 MB, about 30 seconds.":"Las fotos se ajustan solas. Videos de hasta 50 MB, unos 30 segundos.",
  "was on site (auto)":"estuvo en el sitio (auto)","marked install done":"marcó la instalación lista","TCL import":"Importado de TCL","You":"Tú",
  // week and map
  "Service calls":"Llamadas de servicio","One day's route":"Ruta de un día","Plan by area":"Planear por zona","Every open":"Todos abiertos","Everything":"Todo","Fit":"Ajustar","Zoom in":"Acercar","Zoom out":"Alejar","Map of jobs":"Mapa de trabajos","Show":"Mostrar","Looking up places…":"Buscando lugares…",
  "Tap a pin to see the job, the closest jobs around it, and to assign a crew and date. Bulbs show the crew color. Hollow pins have no crew yet.":"Toca un pin para ver el trabajo y los trabajos más cercanos. El color del foco es el del equipo. Los pines vacíos no tienen equipo todavía.",
  "Couldn't load the map. Check your signal.":"No se pudo cargar el mapa. Revisa tu señal.",
  // chat
  "Announcements":"Anuncios","Crew channels":"Canales de equipo","Direct messages":"Mensajes directos","Send a message":"Escribe un mensaje","No messages yet":"Todavía no hay mensajes","No messages yet.":"Todavía no hay mensajes.","Pick a channel or a person.":"Elige un canal o una persona.","Only the office can post announcements.":"Solo la oficina puede publicar anuncios.","Only the office posts here":"Solo la oficina publica aquí",
  // truck list
  "C9 bulbs":"Focos C9","Mini lights":"Luces mini","Clips":"Clips","Copy truck list":"Copiar lista del camión","Built from each job's \"what goes where\" list. Bring extra bulbs and clips. Footage only counts where it's on the job.":"Hecha con la lista de \"qué va dónde\" de cada trabajo. Lleva focos y clips extra.",
  // partly done / problems
  "Why couldn't you finish?":"¿Por qué no pudiste terminar?","What's left to do":"Qué falta por hacer","Ran out of time":"Se acabó el tiempo","Ran out of material":"Se acabó el material","Weather":"Clima","Customer asked to stop":"El cliente pidió parar","Equipment problem":"Problema con el equipo","Other":"Otro","Anything else? (optional)":"¿Algo más? (opcional)",
  "Send to the office":"Enviar a la oficina","The office gets this right away and schedules the return visit.":"La oficina lo recibe al instante y programa la visita de regreso.","The office gets this and schedules the fix. Add photos in Notes & photos.":"La oficina lo recibe y programa el arreglo. Agrega fotos en Notas y fotos.",
  "What's wrong":"Qué está mal","Bulbs out":"Focos apagados","Section out":"Sección apagada","Hanging or loose":"Colgando o suelto","Won't turn on / timer":"No prende / temporizador","Damage":"Daño","Wants a change":"Quiere un cambio","Not urgent":"No es urgente","Urgent":"Urgente","What did you see? Which part of the house?":"¿Qué viste? ¿Qué parte de la casa?",
  // account, time
  "Signed in":"Sesión iniciada","Sign out":"Cerrar sesión","Change my PIN":"Cambiar mi PIN","New 6-digit PIN":"Nuevo PIN de 6 dígitos","Type it again":"Escríbelo otra vez","Save new PIN":"Guardar nuevo PIN","My headshot":"Mi foto","Look":"Apariencia","Bulb colors":"Colores de focos",
  "Light or dark":"Claro u oscuro","Dark after sunset":"Oscuro después del atardecer","Always light":"Siempre claro","Always dark":"Siempre oscuro","Match my phone":"Como mi teléfono","Startup lights":"Luces al iniciar","Once a day":"Una vez al día","Off":"Apagado","Play it now":"Verlo ahora","Snow on":"Nieve activa","Buzz on":"Vibración activa",
  "Or build your own: tap colors in the order you want them on the strand.":"O crea la tuya: toca los colores en el orden que los quieres en la tira.",
  "Warm white":"Blanco cálido","Pure white":"Blanco puro","Warm + pure white":"Blanco cálido + puro","Classic multicolor":"Multicolor clásico","Red & green":"Rojo y verde","Candy cane":"Bastón de caramelo","Red, white & green":"Rojo, blanco y verde","Blue & white":"Azul y blanco","Icy":"Hielo","Red, white & blue":"Rojo, blanco y azul","Green & gold":"Verde y dorado","Purple & teal":"Morado y turquesa","Halloween":"Halloween","Rainbow":"Arcoíris",
  "Red":"Rojo","Green":"Verde","Blue":"Azul","Purple":"Morado","Orange":"Naranja","Yellow":"Amarillo","Teal":"Turquesa","Warm":"Cálido","White":"Blanco",
  "+ Add missing time":"+ Agregar tiempo faltante","Add missing time":"Agregar tiempo faltante","Request fix":"Pedir corrección","Requested":"Pedido","Fix my time":"Corregir mi tiempo","Send to a manager":"Enviar a un gerente","‹ Prev":"‹ Anterior","Next ›":"Siguiente ›",
  "Location missed something, or you forgot to clock in or out? Send a fix and a manager approves it.":"¿La ubicación falló, o se te olvidó marcar entrada o salida? Envía una corrección y un gerente la aprueba.",
  "Day":"Día","What":"Qué","Which job":"Qué trabajo","Pick the job":"Elige el trabajo","At a job":"En un trabajo","Start":"Inicio","End":"Fin","What happened":"Qué pasó","Stops from that week are listed.":"Aparecen las paradas de esa semana.",
  "e.g. Phone died at the Klees job, I left at 3:40":"ej. Se murió mi teléfono en el trabajo Klees, salí a las 3:40","My requests":"Mis pedidos","Waiting":"Esperando","Approved":"Aprobado","Denied":"Negado","Canceled":"Cancelado","Cancel":"Cancelar","No time yet this week.":"Todavía no hay tiempo esta semana.",
  "Close":"Cerrar","Save":"Guardar","Back":"Atrás","Edit":"Editar","Delete":"Borrar","Copy text":"Copiar texto",
  // sign-in
  "Enter your PIN":"Escribe tu PIN","That PIN didn't match. Try again.":"Ese PIN no coincide. Intenta otra vez.","Take or choose a photo":"Toma o elige una foto","Use this photo":"Usar esta foto","Pick a different one":"Elegir otra","Saving…":"Guardando…","Pick a set of colors":"Elige un juego de colores",
  "It shows when you sign in and next to your messages. A clear photo of your face works best.":"Aparece cuando entras y junto a tus mensajes. Una foto clara de tu cara es lo mejor.",
  "Your colors light up the bulbs across the board: your route, check-offs and the welcome screen. You can change them later in Account.":"Tus colores encienden los focos en todo el tablero: tu ruta, lo que marcas y la bienvenida. Puedes cambiarlos luego en Cuenta.",
  // toasts
  "Marked done":"Marcado como listo","Posted":"Publicado","Saved":"Guardado","Deleted":"Borrado","Removed":"Quitado","PIN changed":"PIN cambiado","Photo saved":"Foto guardada","Saving photo…":"Guardando foto…","Sent to the office":"Enviado a la oficina","Sent. A manager will approve it.":"Enviado. Un gerente lo va a aprobar.","Request canceled":"Pedido cancelado",
  "Use exactly 6 digits":"Usa exactamente 6 dígitos","The two PINs don't match":"Los dos PIN no coinciden","Write a note or add a photo first":"Primero escribe una nota o agrega una foto","Auto clock-in is on. Keep the board open on screen.":"La entrada automática está activa. Deja el tablero abierto en la pantalla.",
  "This phone can't share its location with the board.":"Este teléfono no puede compartir su ubicación con el tablero.","Copied. Paste it into the group chat.":"Copiado. Pégalo en el chat del grupo.","This job has no address":"Este trabajo no tiene dirección","Near the shop (couldn't get your location)":"Cerca del taller (no se pudo obtener tu ubicación)","Couldn't get access":"No se pudo obtener acceso",
  "Drive-thru":"Autoservicio","You signed in with the PIN the office gave you. Choose a new 6-digit PIN only you know.":"Entraste con el PIN que te dio la oficina. Elige un PIN nuevo de 6 dígitos que solo tú sepas.","Save my PIN":"Guardar mi PIN","Use exactly 6 digits.":"Usa exactamente 6 dígitos.","The two PINs don't match.":"Los dos PIN no coinciden.","Pick a PIN that's different from the one the office gave you.":"Elige un PIN diferente al que te dio la oficina.","That PIN is too easy to guess. Try another.":"Ese PIN es muy fácil de adivinar. Prueba otro.","That PIN is taken. Pick another.":"Ese PIN ya está en uso. Elige otro.","Checks off":"Marca trabajos","Own crew only":"Solo su equipo","Manager":"Gerente","Money":"Dinero","Crew lead":"Líder de equipo","Crew member":"Miembro del equipo","Sees all crews":"Ve todos los equipos","Quick":"Rápido","Language":"Idioma"
};
const ES_RX = [
  [/^(\d+) jobs?$/, (m,n)=>`${n} trabajo${n==1?"":"s"}`], [/^(\d+) clients?$/, (m,n)=>`${n} cliente${n==1?"":"s"}`], [/^(\d+) stops?$/, (m,n)=>`${n} parada${n==1?"":"s"}`], [/^(\d+) runs?$/, (m,n)=>`${n} tramo${n==1?"":"s"}`],
  [/^(\d+)\/(\d+) done$/, (m,a,b)=>`${a}/${b} listas`], [/^(\d+) on map$/, (m,n)=>`${n} en el mapa`],
  [/^(\d+) days? to Christmas · (\d+) of (\d+) houses lit$/, (m,a,b,c)=>`Faltan ${a} días para Navidad · ${b} de ${c} casas encendidas`],
  [/^STOP (\d+)$/, (m,n)=>`PARADA ${n}`], [/^Mark (install|takedown|service|return) done$/i, (m,t)=>`Marcar ${({install:"instalación",takedown:"retiro",service:"servicio",return:"regreso"})[t.toLowerCase()]} lista`],
  [/^Clock out · (.+)$/, (m,a)=>`Marcar salida · ${a}`], [/^My time · this week · (.+)$/, (m,a)=>`Mi tiempo · esta semana · ${a}`], [/^My time · week of (.+) · (.+)$/, (m,a,b)=>`Mi tiempo · semana del ${a} · ${b}`],
  [/^Week of (.+)$/, (m,a)=>`Semana del ${a}`], [/^Lit, no takedown date · (\d+)$/, (m,n)=>`Encendidos, sin fecha de retiro · ${n}`], [/^Booked, no install date · (\d+)$/, (m,n)=>`Reservados, sin fecha de instalación · ${n}`],
  [/^Today · (.+) · (\d+)\/(\d+) done$/, (m,a,b,c)=>`Hoy · ${tr1(a)} · ${b}/${c} listas`], [/^Today · (.+) · no stops$/, (m,a)=>`Hoy · ${tr1(a)} · sin paradas`],
  [/^✓ Done · (.+)$/, (m,a)=>`✓ Listo · ${a.replace(/^You\b/,"Tú")}`], [/^(.+) · Account$/, (m,a)=>`${a} · Cuenta`], [/^≈(\d+) mi, shop and back$/, (m,n)=>`≈${n} mi, ida y vuelta al taller`],
  [/^No stops (today|tomorrow|yesterday|this day)$/i, (m,a)=>`Sin paradas ${({today:"hoy",tomorrow:"mañana",yesterday:"ayer","this day":"este día"})[a.toLowerCase()]}`],
  [/^(.+), pick your lights$/, (m,a)=>`${a}, elige tus luces`], [/^(.+), pick your own PIN$/, (m,a)=>`${a}, elige tu propio PIN`], [/^Hey (.+)! Add your headshot$/, (m,a)=>`¡Hola ${a}! Agrega tu foto`], [/^Welcome, (.+)!$/, (m,a)=>`¡Hola, ${a}!`], [/^(\d+)\/(\d+) on TCL's checklist$/, (m,a,b)=>`${a}/${b} en la lista de TCL`], [/^Use (.+)$/, (m,a)=>ES[a]?`Usar ${ES[a]}`:null],
  [/^on site (.+) \((\d+) people\)$/, (m,a,n)=>`en sitio ${a} (${n} personas)`], [/^Couldn't (.+)\. Check your signal and try again\.$/, ()=>"No se pudo guardar. Revisa tu señal e intenta otra vez."],
  [/^Signal's back\. Sent (\d+) changes?\.$/, (m,n)=>`Volvió la señal. Se enviaron ${n} cambio${n==1?"":"s"}.`], [/^(\d+) waiting for signal$/, (m,n)=>`${n} esperando señal`],
];
function tr1(k){ if(ES[k]!=null) return ES[k]; for(const [r,f] of ES_RX){ const m=k.match(r); if(m){ const v=f(...m); if(v!=null) return v; } }
  if(k.includes(" · ")){ const parts=k.split(" · "); let hit=false; const out=parts.map(p=>{ const t=ES[p.trim()]; if(t!=null){ hit=true; return t; } const m=p.match(/^(Install|Takedown|Service|Return) (.+)$/); if(m){ hit=true; return ES[m[1]]+" "+m[2]; } return p; }); if(hit) return out.join(" · "); }
  const m=k.match(/^(Install|Takedown|Service|Return) (.{2,12})$/); if(m) return ES[m[1]]+" "+m[2];
  return k; }
const I18N_SKIP = "script,style,textarea,.t-notes,.bub .txt,.entry .txt,.note-raw,[data-no-i18n],.msg textarea";
function trText(n){ const v=n.nodeValue, k=v.trim(); if(!k||!/[A-Za-z]/.test(k)) return; const p=n.parentElement; if(!p||p.closest(I18N_SKIP)) return; const t=tr1(k); if(t!==k) n.nodeValue=v.replace(k,t); }
function trEl(el){ if(el.closest&&el.closest(I18N_SKIP)) return; for(const a of ["placeholder","aria-label","title"]){ const v=el.getAttribute&&el.getAttribute(a); if(v){ const t=tr1(v.trim()); if(t!==v.trim()) el.setAttribute(a,t); } } }
function trTree(root){ if(!LANG_ES||!root) return; if(root.nodeType===3) return trText(root); if(root.nodeType!==1) return; trEl(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeType===1&&n.matches(I18N_SKIP)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}); let n; while(n=w.nextNode()){ n.nodeType===3?trText(n):trEl(n); } }
if(LANG_ES){ document.documentElement.lang="es"; const run=()=>{ trTree(document.body); new MutationObserver(ms=>{ for(const m of ms){ if(m.type==="characterData") trText(m.target); else m.addedNodes.forEach(trTree); } }).observe(document.body,{childList:true,subtree:true,characterData:true}); }; document.body?run():document.addEventListener("DOMContentLoaded",run); }
function setLang(l){ try{ localStorage.setItem("lang",l); }catch(e){} if(window.PL&&PL.setLang) PL.setLang(l).catch(()=>{}).finally(()=>location.reload()); else location.reload(); }
