# Render redirect page

`index.html` replaces chamredb.onrender.com with a one-page redirect to the GitHub Pages site. It is not part of the app build.

Render setup (dashboard): delete the old Node service (it has `NODE_VERSION` pinned to 12.22.12 and fails to build), then New, Static Site, repository `antunderwood/chamredb-live`, branch `main`, build command empty (or `echo ok`), publish directory `redirect`, name `chamredb` so the address stays chamredb.onrender.com. Leave `NODE_VERSION` unset. Old search links (the 2021 site had no shareable address) land on the new home page.
