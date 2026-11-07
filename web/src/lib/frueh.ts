// Frueh ausgefuehrte Inline-Skripte (KEIN "use client": sonst werden die Strings zu Client-Referenzen)
export const THEME_SKRIPT = `try{var t=localStorage.getItem("anruf-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
/** Chromes Web-App-Installation auf Android abfangen (dort gibt es die echte App). */
export const INSTALL_SPERRE = `window.addEventListener("beforeinstallprompt",function(e){if(/Android/i.test(navigator.userAgent)){e.preventDefault();window.__anrufInstallGesperrt=true}});`;
