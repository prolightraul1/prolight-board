# A visit whose type is missing or not one of install/takedown/service crashed the Route and Today
# screens (VTYPE[v.type] was undefined). Unknown types now read as "Visit". Applied after phase57.py.
rep('const VTYPE = {install:"Install",takedown:"Takedown",service:"Service"};',
    'const VTYPE = new Proxy({install:"Install",takedown:"Takedown",service:"Service"},{get:(o,k)=>typeof k==="string"?(Object.prototype.hasOwnProperty.call(o,k)?o[k]:"Visit"):o[k]});')
