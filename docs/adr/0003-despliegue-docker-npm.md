# Despliegue: Docker en Oracle Free Tier, TLS y publicación externa vía Nginx Proxy Manager

El GDT-Santiago se ejecuta como un stack de contenedores Docker (nginx, PostGIS, pg_tileserv, app) en un único servidor Oracle Free Tier, expuesto a Internet solo a través de Nginx Proxy Manager (NPM) que corre en el host o en un contenedor independiente del mismo host. NPM termina TLS con Let's Encrypt y sirve como proxy inverso al GDT. El GDT habla HTTP plano en la red interna de Docker; nada de su stack expone puertos a Internet directamente. El subdominio final (p. ej. `gdt.movilab.es`) lo define el titular del dominio movilab.es al desplegar.

**Considered options**
- Docker + NPM + Let's Encrypt + subdominio de movilab.es (elegido) — el operador del dominio controla el DNS, NPM automatiza renovación de certificados, aislamiento claro entre el stack y la terminación TLS.
- TLS terminado en el nginx del propio stack con certbot dentro del contenedor (rechazado) — acopla el ciclo de vida de los certificados al ciclo del stack; si el stack se rompe, los certificados también.
- Exponer el stack directamente a Internet sin proxy inverso (rechazado) — todos los servicios del stack serían accesibles individualmente; superficie de ataque innecesaria.
- Despliegue en VM/servidor dedicado gestionado a mano sin Docker (rechazado) — más difícil de reproducir, versionar y migrar; rompe "monolítico reproducible".

**Consequences**
- El `docker-compose.yml` del GDT asume una red Docker interna; las URLs públicas pasan por NPM y nunca aparecen en la configuración del stack.
- Si NPM se cae, el GDT sigue accesible en HTTP por la LAN; la caída afecta solo a usuarios externos y al TLS.
- Los certificados Let's Encrypt se renuevan automáticamente vía NPM; el operador del dominio solo tiene que apuntar el subdominio al IP del host y crear el `Proxy Host` en NPM.
- El `docker-compose.yml` puede contener solo el GDT o también NPM; el ADR no fija esa decisión, que se toma al desplegar.
