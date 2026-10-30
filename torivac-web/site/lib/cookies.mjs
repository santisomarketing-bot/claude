// [COOKIES] Texto de la «Política de cookies» propia (4 idiomas). La web original la tenía como un shortcode dinámico de Complianz que no se puede copiar, y su dirección (/politica-de-cookies/, en los 4 idiomas)
// dejaría de existir al publicar esta web: se genera aquí con lo que la web guarda de verdad. BORRADOR escrito por el proyecto: lo valida quien lleve lo legal de Torivac (docs/GOOGLE.md §Textos).
//   · Sin IDs de Google: dice que no hay cookies de estadística ni de publicidad.
//   · Con GA4 y/o Ads: añade la tabla de cookies de Google que corresponda, cómo cambiar la decisión y la transferencia de datos.
// Los enlaces van como [texto](legal) o [texto](privacy) (se resuelven con los del pie de cada idioma) o [texto](https://…).

export const COOKIE_VERSION = '2026-10';

/** Textos por idioma. Las claves `r_*` son filas de las tablas: [nombre, dónde, para qué, cuánto dura]. */
const X = {
  es: {
    title: 'Política de cookies',
    lead: 'Esta política explica qué guarda esta web en tu dispositivo, para qué sirve y cómo puedes aceptarlo, rechazarlo o cambiarlo.',
    h_what: '¿Qué son las cookies?',
    p_what: 'Las cookies son pequeños archivos que una web guarda en tu dispositivo. Esta política también cubre tecnologías parecidas, como el almacenamiento local del navegador (localStorage), que usamos para recordar tus preferencias.',
    h_who: '¿Quién es el responsable?',
    p_who: 'El responsable de esta web es el titular que figura en el [Aviso legal](legal). Cómo tratamos los datos personales está explicado en la [Política de privacidad](privacy).',
    h_used: 'Qué guardamos y para qué',
    h_nec: 'Necesarias (no necesitan tu consentimiento)',
    p_nec: 'Hacen que la web funcione y recuerdan lo que has pedido. No se pueden desactivar y no sirven para seguirte ni para publicidad.',
    cols: ['Nombre', 'Dónde', 'Para qué', 'Cuánto dura'],
    w_local: 'Tu navegador (localStorage)', w_session: 'Tu navegador (sessionStorage)', w_cookie: 'Cookie (esta web)',
    r_quote: ['tv_quote_v1, tv_quote_t', 'w_local', 'Guardan los productos que añades a tu presupuesto.', 'Hasta que vacíes el presupuesto o borres los datos del navegador'],
    r_lang: ['tv_lang', 'w_local', 'Recuerda el idioma que has elegido.', 'Hasta que borres los datos del navegador'],
    r_session: ['tv_lang_dismiss, tv_o_hint', 'w_session', 'Recuerdan que ya has visto un aviso de la página.', 'Hasta que cierres la pestaña'],
    r_theme: ['tv-theme', 'w_local', 'Recuerda el aspecto visual que has elegido.', 'Hasta que borres los datos del navegador'],
    r_consent: ['tv-consent', 'w_local', 'Guarda tu decisión sobre las cookies de Google.', '12 meses'],
    h_stats: 'Estadísticas (solo si las aceptas)',
    p_stats: 'Usamos Google Analytics 4, de Google, para saber cuántas personas visitan la web y qué páginas ven. Solo se activa si lo aceptas. Los informes que vemos son estadísticos.',
    r_ga: ['_ga', 'w_cookie', 'Distingue a unos visitantes de otros para contar las visitas.', '2 años'],
    r_ga_id: ['_ga_<ID>', 'w_cookie', 'Mantiene el estado de la sesión de medición.', '2 años'],
    h_ads: 'Publicidad (solo si la aceptas)',
    p_ads: 'Usamos Google Ads para saber qué anuncios llevan a pedir un presupuesto o a escribirnos y, si lo aceptas, para mostrarte publicidad adaptada. Solo se activa si lo aceptas.',
    r_gcl_au: ['_gcl_au', 'w_cookie', 'Guarda qué anuncio te trajo hasta aquí para medir las conversiones.', '3 meses'],
    r_gcl_aw: ['_gcl_aw', 'w_cookie', 'Guarda el clic en el anuncio (gclid) para atribuir la conversión.', '3 meses'],
    r_gac: ['_gac_gb_<ID>', 'w_cookie', 'Une las campañas de Google Ads con la medición de Analytics.', '3 meses'],
    p_none: 'Esta web no usa cookies de estadística ni de publicidad.',
    h_change: 'Cómo cambiar tu decisión',
    p_change: 'Te lo preguntamos la primera vez que entras. Puedes cambiar tu decisión cuando quieras con el botón «Configurar cookies» del pie de la página (retirar el consentimiento es tan fácil como darlo). También puedes borrar los datos de esta web desde los ajustes de tu navegador.',
    p_change_browser: 'Puedes borrar los datos de esta web desde los ajustes de tu navegador.',
    p_optout: 'Si no quieres que Google Analytics mida tu navegación en ninguna web, puedes instalar el [complemento de inhabilitación de Google Analytics](https://tools.google.com/dlpage/gaoptout).',
    h_google: 'Google y la transferencia de datos',
    p_google: 'Los datos que recoge Google se tratan según su [política de privacidad](https://policies.google.com/privacy) y su [información sobre cookies](https://policies.google.com/technologies/cookies). Google puede tratar datos fuera del Espacio Económico Europeo, en EE. UU., donde Google LLC está adherida al Marco de Privacidad de Datos UE-EE. UU.',
    h_upd: 'Actualizaciones',
    p_upd: 'Podemos actualizar esta política si cambian las herramientas que usa la web. Versión de este texto: octubre de 2026.',
  },
  en: {
    title: 'Cookie policy',
    lead: 'This policy explains what this website stores on your device, what it is for, and how you can accept, reject or change it.',
    h_what: 'What are cookies?',
    p_what: 'Cookies are small files that a website saves on your device. This policy also covers similar technologies, such as the browser’s local storage (localStorage), which we use to remember your preferences.',
    h_who: 'Who is responsible?',
    p_who: 'The party responsible for this website is the owner named in the [Legal Notice](legal). How we handle personal data is explained in the [Privacy Policy](privacy).',
    h_used: 'What we store and why',
    h_nec: 'Necessary (no consent needed)',
    p_nec: 'They make the website work and remember what you asked for. They cannot be turned off and are not used to track you or for advertising.',
    cols: ['Name', 'Where', 'Purpose', 'Duration'],
    w_local: 'Your browser (localStorage)', w_session: 'Your browser (sessionStorage)', w_cookie: 'Cookie (this website)',
    r_quote: ['tv_quote_v1, tv_quote_t', 'w_local', 'They keep the products you add to your quote.', 'Until you empty the quote or clear your browser data'],
    r_lang: ['tv_lang', 'w_local', 'It remembers the language you chose.', 'Until you clear your browser data'],
    r_session: ['tv_lang_dismiss, tv_o_hint', 'w_session', 'They remember that you have already seen a notice on the page.', 'Until you close the tab'],
    r_theme: ['tv-theme', 'w_local', 'It remembers the visual style you chose.', 'Until you clear your browser data'],
    r_consent: ['tv-consent', 'w_local', 'It saves your choice about Google cookies.', '12 months'],
    h_stats: 'Statistics (only if you accept)',
    p_stats: 'We use Google Analytics 4, from Google, to learn how many people visit the website and which pages they view. It is only activated if you accept. The reports we see are statistical.',
    r_ga: ['_ga', 'w_cookie', 'Tells visitors apart in order to count visits.', '2 years'],
    r_ga_id: ['_ga_<ID>', 'w_cookie', 'Keeps the state of the measurement session.', '2 years'],
    h_ads: 'Advertising (only if you accept)',
    p_ads: 'We use Google Ads to find out which ads lead people to request a quote or write to us and, if you accept, to show you adapted advertising. It is only activated if you accept.',
    r_gcl_au: ['_gcl_au', 'w_cookie', 'Stores which ad brought you here so conversions can be measured.', '3 months'],
    r_gcl_aw: ['_gcl_aw', 'w_cookie', 'Stores the ad click (gclid) so the conversion can be attributed.', '3 months'],
    r_gac: ['_gac_gb_<ID>', 'w_cookie', 'Links Google Ads campaigns with Analytics measurement.', '3 months'],
    p_none: 'This website does not use statistics or advertising cookies.',
    h_change: 'How to change your decision',
    p_change: 'We ask you the first time you visit. You can change your decision at any time with the “Cookie settings” button in the page footer (withdrawing consent is as easy as giving it). You can also delete this website’s data in your browser settings.',
    p_change_browser: 'You can delete this website’s data in your browser settings.',
    p_optout: 'If you do not want Google Analytics to measure your browsing on any website, you can install the [Google Analytics opt-out browser add-on](https://tools.google.com/dlpage/gaoptout).',
    h_google: 'Google and data transfers',
    p_google: 'The data Google collects is processed under its [privacy policy](https://policies.google.com/privacy) and its [information on cookies](https://policies.google.com/technologies/cookies). Google may process data outside the European Economic Area, in the United States, where Google LLC participates in the EU–US Data Privacy Framework.',
    h_upd: 'Updates',
    p_upd: 'We may update this policy if the tools the website uses change. Version of this text: October 2026.',
  },
  fr: {
    title: 'Politique de cookies',
    lead: 'Cette politique explique ce que ce site enregistre sur votre appareil, à quoi cela sert et comment vous pouvez l’accepter, le refuser ou le modifier.',
    h_what: 'Que sont les cookies ?',
    p_what: 'Les cookies sont de petits fichiers qu’un site enregistre sur votre appareil. Cette politique couvre aussi des technologies similaires, comme le stockage local du navigateur (localStorage), que nous utilisons pour mémoriser vos préférences.',
    h_who: 'Qui est responsable ?',
    p_who: 'Le responsable de ce site est le titulaire indiqué dans les [Mentions légales](legal). La manière dont nous traitons les données personnelles est expliquée dans la [Politique de confidentialité](privacy).',
    h_used: 'Ce que nous enregistrons et pourquoi',
    h_nec: 'Nécessaires (sans consentement)',
    p_nec: 'Ils font fonctionner le site et mémorisent ce que vous avez demandé. Ils ne peuvent pas être désactivés et ne servent ni à vous suivre ni à la publicité.',
    cols: ['Nom', 'Où', 'Utilité', 'Durée'],
    w_local: 'Votre navigateur (localStorage)', w_session: 'Votre navigateur (sessionStorage)', w_cookie: 'Cookie (ce site)',
    r_quote: ['tv_quote_v1, tv_quote_t', 'w_local', 'Ils conservent les produits que vous ajoutez à votre devis.', 'Jusqu’à ce que vous vidiez le devis ou effaciez les données du navigateur'],
    r_lang: ['tv_lang', 'w_local', 'Il mémorise la langue que vous avez choisie.', 'Jusqu’à ce que vous effaciez les données du navigateur'],
    r_session: ['tv_lang_dismiss, tv_o_hint', 'w_session', 'Ils mémorisent que vous avez déjà vu un avis de la page.', 'Jusqu’à la fermeture de l’onglet'],
    r_theme: ['tv-theme', 'w_local', 'Il mémorise l’aspect visuel que vous avez choisi.', 'Jusqu’à ce que vous effaciez les données du navigateur'],
    r_consent: ['tv-consent', 'w_local', 'Il enregistre votre choix concernant les cookies de Google.', '12 mois'],
    h_stats: 'Statistiques (uniquement si vous acceptez)',
    p_stats: 'Nous utilisons Google Analytics 4, de Google, pour savoir combien de personnes visitent le site et quelles pages elles consultent. Il n’est activé que si vous acceptez. Les rapports que nous consultons sont statistiques.',
    r_ga: ['_ga', 'w_cookie', 'Distingue les visiteurs pour compter les visites.', '2 ans'],
    r_ga_id: ['_ga_<ID>', 'w_cookie', 'Conserve l’état de la session de mesure.', '2 ans'],
    h_ads: 'Publicité (uniquement si vous acceptez)',
    p_ads: 'Nous utilisons Google Ads pour savoir quelles annonces amènent à demander un devis ou à nous écrire et, si vous acceptez, pour vous montrer une publicité adaptée. Il n’est activé que si vous acceptez.',
    r_gcl_au: ['_gcl_au', 'w_cookie', 'Enregistre quelle annonce vous a amené ici pour mesurer les conversions.', '3 mois'],
    r_gcl_aw: ['_gcl_aw', 'w_cookie', 'Enregistre le clic sur l’annonce (gclid) pour attribuer la conversion.', '3 mois'],
    r_gac: ['_gac_gb_<ID>', 'w_cookie', 'Relie les campagnes Google Ads à la mesure d’Analytics.', '3 mois'],
    p_none: 'Ce site n’utilise pas de cookies de statistiques ni de publicité.',
    h_change: 'Comment modifier votre choix',
    p_change: 'Nous vous le demandons lors de votre première visite. Vous pouvez modifier votre choix à tout moment avec le bouton « Paramétrer les cookies » en bas de page (retirer son consentement est aussi simple que le donner). Vous pouvez aussi effacer les données de ce site dans les paramètres de votre navigateur.',
    p_change_browser: 'Vous pouvez effacer les données de ce site dans les paramètres de votre navigateur.',
    p_optout: 'Si vous ne souhaitez pas que Google Analytics mesure votre navigation sur aucun site, vous pouvez installer le [module complémentaire de désactivation de Google Analytics](https://tools.google.com/dlpage/gaoptout).',
    h_google: 'Google et transferts de données',
    p_google: 'Les données collectées par Google sont traitées selon sa [politique de confidentialité](https://policies.google.com/privacy) et ses [informations sur les cookies](https://policies.google.com/technologies/cookies). Google peut traiter des données en dehors de l’Espace économique européen, aux États-Unis, où Google LLC adhère au cadre de protection des données UE–États-Unis.',
    h_upd: 'Mises à jour',
    p_upd: 'Nous pouvons mettre à jour cette politique si les outils utilisés par le site changent. Version de ce texte : octobre 2026.',
  },
  de: {
    title: 'Cookie-Richtlinie',
    lead: 'Diese Richtlinie erklärt, was diese Website auf Ihrem Gerät speichert, wozu das dient und wie Sie dem zustimmen, es ablehnen oder ändern können.',
    h_what: 'Was sind Cookies?',
    p_what: 'Cookies sind kleine Dateien, die eine Website auf Ihrem Gerät speichert. Diese Richtlinie gilt auch für ähnliche Technologien wie den lokalen Speicher des Browsers (localStorage), den wir nutzen, um Ihre Einstellungen zu merken.',
    h_who: 'Wer ist verantwortlich?',
    p_who: 'Verantwortlich für diese Website ist der in den [Rechtlichen Hinweisen](legal) genannte Inhaber. Wie wir personenbezogene Daten verarbeiten, steht in den [Datenschutzrichtlinien](privacy).',
    h_used: 'Was wir speichern und wozu',
    h_nec: 'Notwendig (ohne Einwilligung)',
    p_nec: 'Sie sorgen dafür, dass die Website funktioniert, und merken sich, was Sie angefragt haben. Sie lassen sich nicht abschalten und dienen weder zur Verfolgung noch zur Werbung.',
    cols: ['Name', 'Wo', 'Zweck', 'Dauer'],
    w_local: 'Ihr Browser (localStorage)', w_session: 'Ihr Browser (sessionStorage)', w_cookie: 'Cookie (diese Website)',
    r_quote: ['tv_quote_v1, tv_quote_t', 'w_local', 'Speichern die Produkte, die Sie Ihrem Angebot hinzufügen.', 'Bis Sie das Angebot leeren oder die Browserdaten löschen'],
    r_lang: ['tv_lang', 'w_local', 'Merkt sich die gewählte Sprache.', 'Bis Sie die Browserdaten löschen'],
    r_session: ['tv_lang_dismiss, tv_o_hint', 'w_session', 'Merken sich, dass Sie einen Hinweis der Seite schon gesehen haben.', 'Bis Sie den Tab schließen'],
    r_theme: ['tv-theme', 'w_local', 'Merkt sich das gewählte Erscheinungsbild.', 'Bis Sie die Browserdaten löschen'],
    r_consent: ['tv-consent', 'w_local', 'Speichert Ihre Entscheidung zu den Google-Cookies.', '12 Monate'],
    h_stats: 'Statistik (nur mit Ihrer Einwilligung)',
    p_stats: 'Wir nutzen Google Analytics 4 von Google, um zu erfahren, wie viele Personen die Website besuchen und welche Seiten sie ansehen. Es wird nur aktiviert, wenn Sie zustimmen. Die Berichte, die wir sehen, sind statistisch.',
    r_ga: ['_ga', 'w_cookie', 'Unterscheidet Besucher, um Besuche zu zählen.', '2 Jahre'],
    r_ga_id: ['_ga_<ID>', 'w_cookie', 'Hält den Status der Messsitzung fest.', '2 Jahre'],
    h_ads: 'Werbung (nur mit Ihrer Einwilligung)',
    p_ads: 'Wir nutzen Google Ads, um zu erfahren, welche Anzeigen zu einer Angebotsanfrage oder Nachricht führen, und, wenn Sie zustimmen, um Ihnen angepasste Werbung zu zeigen. Es wird nur aktiviert, wenn Sie zustimmen.',
    r_gcl_au: ['_gcl_au', 'w_cookie', 'Speichert, welche Anzeige Sie hierher geführt hat, um Conversions zu messen.', '3 Monate'],
    r_gcl_aw: ['_gcl_aw', 'w_cookie', 'Speichert den Anzeigenklick (gclid), um die Conversion zuzuordnen.', '3 Monate'],
    r_gac: ['_gac_gb_<ID>', 'w_cookie', 'Verknüpft Google-Ads-Kampagnen mit der Messung in Analytics.', '3 Monate'],
    p_none: 'Diese Website verwendet keine Statistik- oder Werbe-Cookies.',
    h_change: 'So ändern Sie Ihre Entscheidung',
    p_change: 'Wir fragen Sie beim ersten Besuch. Sie können Ihre Entscheidung jederzeit über die Schaltfläche „Cookie-Einstellungen“ im Seitenfuß ändern (die Einwilligung zu widerrufen ist so einfach, wie sie zu erteilen). Die Daten dieser Website können Sie auch in den Browsereinstellungen löschen.',
    p_change_browser: 'Die Daten dieser Website können Sie in den Browsereinstellungen löschen.',
    p_optout: 'Wenn Sie nicht möchten, dass Google Analytics Ihr Surfen auf irgendeiner Website misst, können Sie das [Browser-Add-on zur Deaktivierung von Google Analytics](https://tools.google.com/dlpage/gaoptout) installieren.',
    h_google: 'Google und Datenübermittlung',
    p_google: 'Die von Google erhobenen Daten werden nach dessen [Datenschutzerklärung](https://policies.google.com/privacy) und den [Informationen zu Cookies](https://policies.google.com/technologies/cookies) verarbeitet. Google kann Daten außerhalb des Europäischen Wirtschaftsraums in den USA verarbeiten, wo Google LLC am EU-US Data Privacy Framework teilnimmt.',
    h_upd: 'Aktualisierungen',
    p_upd: 'Wir können diese Richtlinie anpassen, wenn sich die von der Website genutzten Werkzeuge ändern. Fassung dieses Textes: Oktober 2026.',
  },
};

/** Título de la página en el idioma `lang` (el pie y el h1 usan el de la web original si existe; este es el respaldo). */
export const cookieTitle = (lang) => (X[lang] || X.es).title;

/**
 * Bloques de la política en el idioma `lang`, según lo que la web mide de verdad:
 *   g = { ga4: bool, ads: bool }, themeSwitch: la compilación lleva selector de aspecto (si no, no se guarda `tv-theme`).
 * Devuelve [{ t: 'h2'|'h3'|'p'|'table', … }]; el HTML lo monta templates.mjs (cookiePageBody).
 */
export function cookieBlocks(lang, { ga4 = false, ads = false, themeSwitch = false } = {}) {
  const x = X[lang] || X.es;
  const active = ga4 || ads;
  /** Fila de tabla [nombre, dónde, para qué, cuánto dura] de la clave `k`, con «dónde» ya en el idioma. */
  const row = (k) => { const [n, w, p, d] = x[k]; return [n, x[w] || w, p, d]; };
  const b = [{ t: 'lead', x: x.lead }, { t: 'h2', x: x.h_what }, { t: 'p', x: x.p_what }, { t: 'h2', x: x.h_who }, { t: 'p', x: x.p_who }, { t: 'h2', x: x.h_used }];
  b.push({ t: 'h3', x: x.h_nec }, { t: 'p', x: x.p_nec }, { t: 'table', cols: x.cols, rows: ['r_quote', 'r_lang', 'r_session', ...(themeSwitch ? ['r_theme'] : []), ...(active ? ['r_consent'] : [])].map(row) });
  if (ga4) b.push({ t: 'h3', x: x.h_stats }, { t: 'p', x: x.p_stats }, { t: 'table', cols: x.cols, rows: ['r_ga', 'r_ga_id'].map(row) });
  if (ads) b.push({ t: 'h3', x: x.h_ads }, { t: 'p', x: x.p_ads }, { t: 'table', cols: x.cols, rows: ['r_gcl_au', 'r_gcl_aw', 'r_gac'].map(row) });
  if (!active) b.push({ t: 'p', x: x.p_none });
  b.push({ t: 'h2', x: x.h_change }, { t: 'p', x: active ? x.p_change : x.p_change_browser });
  if (ga4) b.push({ t: 'p', x: x.p_optout });
  if (active) b.push({ t: 'h2', x: x.h_google }, { t: 'p', x: x.p_google });
  b.push({ t: 'h2', x: x.h_upd }, { t: 'p', x: x.p_upd });
  return b;
}
