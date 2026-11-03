# Phone fit: nothing may be wider than the screen (iPhone Pro Max with Larger Text / page zoom, smaller iPhones).
# Rows of chips and long lines used to stretch the whole page past the right edge, so buttons went off-screen.
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
html,body{max-width:100%}
main.main{min-width:0;max-width:100vw;box-sizing:border-box}
#view,#view>*,main.main>*,.dcard,.dcard>*,.rows,.rows>*,.route-tools,.route-tools>*,.pager>*,.tw,.tw-me,.wk-top>*{min-width:0}
.bar>.chips,.bar>.grow,.bar>.seg,.dayhead>*{min-width:0}
.chips{max-width:100%;flex-wrap:nowrap}
.season,.season-strand{max-width:100%;min-width:0}
.act-row{grid-template-columns:auto auto minmax(0,1fr)}
.drawer,.d-body{max-width:100vw;box-sizing:border-box}.d-body>*{min-width:0}
img,video,canvas,table{max-width:100%}
.tbl{max-width:100%;overflow-x:auto}
.dcard,.obody,.rows,.route-tools,.act-rows{grid-template-columns:minmax(0,1fr)}
.act-row .m,.act-row .n,.act-row .s,.nd-row,.stop,.card{overflow-wrap:anywhere}
@media (max-width:420px){.tw-tiles{gap:6px}.tw-tile{padding:10px}.tw-tile b{font-size:22px}.btn{padding-left:12px;padding-right:12px}}''')
