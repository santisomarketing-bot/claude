# Textos de interfaz escritos por el proyecto (para validar por idioma)

> GENERADO por `node scripts/audit_i18n.mjs` a partir de `site/lib/i18n.mjs` y de la web original. No editar a mano: para cambiar un texto, cámbialo en `site/lib/i18n.mjs` y regenera este documento.

## Por qué existe

La web conserva **tal cual** los textos de la web actual de grupotorivac.com en los cuatro idiomas: fichas, categorías, páginas, entradas, menús y pie. Nada de eso se ha traducido ni reformulado.
Los textos de abajo son los **únicos** que no vienen de ella: botones, etiquetas y avisos de la experiencia nueva (presupuesto, filtros, formularios, panel). Los escribió el proyecto en los cuatro idiomas y **hay que validarlos** antes de publicar: un cambio de palabra puede cambiar el significado de un término técnico.

## Cómo validarlos

1. Abre la sección de tu idioma. Cada fila trae el texto en español como referencia, el texto en tu idioma y la clave.
2. Comprueba que el significado es el mismo que el español y que los **términos técnicos usan la palabra que ya usa la web** (mira el glosario de abajo).
3. Si cambias algo, anota la clave y el texto correcto; se corrige en `site/lib/i18n.mjs` y se regenera este documento.

Las filas con ✓ ya existen tal cual en la web original en ese idioma (por ejemplo, «Contacto» o «Productos»): no hace falta revisarlas y no se listan.

## Glosario de la web original (las palabras que hay que respetar)

| Español | Inglés | Francés | Alemán |
|---|---|---|---|
| Transformadores | Transformers | Transformateurs | Transformatoren |
| Transformadores toroidales | Toroidal transformers | Transformateurs toroïdaux | Ringkerntransformatoren |
| Transformador convencional | Conventional transformer | Transformateur conventionnel | Konventioneller Transformator |
| Estabilizadores de tensión | Voltage stabilizers | Stabilisateurs de tension | Spannungsstabilisatoren |
| Variadores de tensión - Autotransformadores regulables | Voltage variators - Adjustable autotransformers | Régulateurs de tension - Autotransformateurs réglables | Spannungsregler - Einstellbare Spartransformatoren |
| Reostatos y potenciómetros bobinados | Rheostats and coiled potentiometers | Rhéostats et potentiomètres à boudin | Rheostate und Spulenpotentiometer |
| Resistencias \| Bancos de carga | Resistors : Load banks | Résistances : bancs de charge | Widerstände : Lastbänke |
| Bobinas encapsuladas | Encapsulated coils | Bobines encapsulées | Gekapselte Spulen |
| Botones de mando | Control buttons | Boutons de commande | Steuerungstasten |
| Equipos electrónicos | Electronic equipment | Équipements électroniques | Elektronische Ausrüstung |
| Equipos de sobremesa | Benchtop Units | Unités de paillasse | Tafelmodellen |
| Choques \| Inductancias \| Reactancias toroidales | Chokes \| Inductances \| Toroidal Reactances | Inductances \| Réactances toroïdales | Drosseln \| Induktivitäten \| Ringkerndrosseln |

Ojo: la web original no es del todo uniforme: «variador de tensión» aparece como *voltage variators*, *voltage regulator* o *variator* según la ficha, y hay categorías sin traducir o con texto en otro idioma que no se listan aquí (están como propuestas en el panel). Cuando un texto de interfaz nombre uno de estos términos, se usa el de la categoría correspondiente de la tabla, nunca uno inventado.

## Inglés (84 textos a validar; 39 ya existen tal cual en la web original)

| Clave | Español (referencia) | Inglés |
|---|---|---|
| `skip` | Saltar al contenido | Skip to content |
| `quote` | Presupuesto | Quote |
| `quote_yours` | Tu presupuesto | Your quote |
| `quote_empty` | Tu presupuesto está vacío. Añade referencias desde cualquier ficha de producto. | Your quote is empty. Add references from any product page. |
| `add_to_quote` | Añadir al presupuesto | Add to quote |
| `more_refs` | Más referencias de la tarifa | More references in the price list |
| `more_refs_hint` | Códigos de la tarifa vigente que no figuran en la ficha técnica de arriba. | Codes in the current price list that are not in the datasheet above. |
| `description_col` | Descripción | Description |
| `ref_model` | Referencia / modelo | Reference / model |
| `item` | Artículo | Item |
| `unit_price` | Precio unidad | Unit price |
| `total` | Total (sin IVA) | Total (excl. VAT) |
| `price_note_request` | Las líneas «Consultar» no suman al total: se presupuestan aparte. | Lines marked “On request” are not included in the total: they are quoted separately. |
| `demo_prices` | Precios de demostración — no son tarifas de Torivac | Demo prices — not Torivac rates |
| `price_updated` | Precios actualizados | Prices updated |
| `refresh_prices` | Actualizar precios ahora | Update prices now |
| `units` | uds. | pcs |
| `clear` | Vaciar presupuesto | Clear quote |
| `remove` | Quitar | Remove |
| `download_pdf` | Descargar PDF | Download PDF |
| `send_order` | Enviar pedido | Send order |
| `send_hint` | Se enviará a Torivac y recibirás una confirmación por correo. El PDF del presupuesto lo puedes descargar con el otro botón. | It will be sent to Torivac and you will receive an email confirmation. You can download the quote PDF with the other button. |
| `demo_send_note` | DEMO: el envío está simulado, no se manda ningún correo real. | DEMO: sending is simulated, no real email is sent. |
| `order_sent` | Pedido registrado | Order recorded |
| `order_sent_text` | Hemos generado el presupuesto y el borrador de correo. En producción llegaría a info@ y a mzamora@. | We generated the quote and the email draft. In production it would reach info@ and mzamora@. |
| `lab_title` | Así regula un variador de tensión | How a voltage variator regulates |
| `lab_hint` | Mueve el mando: la tensión de salida baja de 230 V a 0 V. | Move the knob: the output voltage drops from 230 V to 0 V. |
| `lab_note` | Ilustración esquemática: onda sinusoidal con valores nominales. | Schematic illustration: sine wave with nominal values. |
| `lab_aria` | Osciloscopio esquemático: la onda de salida se reduce al bajar la tensión con el mando. | Schematic oscilloscope: the output wave shrinks as the knob lowers the voltage. |
| `sending` | Enviando… | Sending… |
| `send_failed` | No hemos podido enviarlo. Inténtalo de nuevo o escríbenos a | We could not send it. Please try again or write to |
| `order_received` | Hemos recibido tu pedido y te hemos enviado una confirmación por correo. | We received your order and emailed you a confirmation. |
| `order_received_nocopy` | Hemos registrado tu pedido, pero no hemos podido enviarte la confirmación por correo. Guarda el PDF con el botón de abajo y, si no tienes noticias nuestras pronto, escríbenos a | We have recorded your order, but could not email you a confirmation. Save the PDF with the button below and, if you do not hear from us soon, write to |
| `message_received` | Mensaje recibido. Te responderemos lo antes posible. | Message received. We will get back to you shortly. |
| `open_email` | Abrir borrador de correo | Open email draft |
| `your_data` | Tus datos | Your details |
| `notes` | Notas para Torivac | Notes for Torivac |
| `accept_privacy` | He leído y acepto la política de privacidad | I have read and accept the privacy policy |
| `required` | Campo obligatorio | Required field |
| `err_plain_text` | Escribe solo texto normal: sin código, etiquetas HTML ni símbolos de programación. | Please use plain text only: no code, HTML tags or programming symbols. |
| `err_too_long` | El texto es demasiado largo (máximo {max} caracteres). | The text is too long (maximum {max} characters). |
| `err_too_many_links` | Incluye como máximo {max} enlaces. | Include no more than {max} links. |
| `err_too_fast` | El formulario se ha enviado demasiado rápido. Espera un momento y vuelve a intentarlo. | The form was submitted too quickly. Please wait a moment and try again. |
| `err_rate` | Demasiados envíos seguidos desde tu conexión. Espera unos minutos e inténtalo de nuevo. | Too many submissions from your connection. Please wait a few minutes and try again. |
| `chars_left` | Quedan {n} caracteres. | {n} characters left. |
| `captcha_note` | Este sitio está protegido por Cloudflare Turnstile y se aplican la Política de Privacidad y los Términos del Servicio de Cloudflare. | This site is protected by Cloudflare Turnstile and the Cloudflare Privacy Policy and Terms of Service apply. |
| `captcha_failed` | No hemos podido comprobar que eres una persona. Recarga la página y vuelve a intentarlo; si usas un bloqueador de contenido, desactívalo para esta página. | We could not verify that you are a person. Reload the page and try again; if you use a content blocker, turn it off for this page. |
| `search_ph` | Buscar por nombre o referencia | Search by name or reference |
| `clear_filters` | Quitar filtros | Clear filters |
| `no_results` | No hay productos con estos filtros. | No products match these filters. |
| `explore_sub` | Explora las subcategorías | Explore subcategories |
| `view_category` | Ver categoría | View category |
| `view_product` | Ver ficha | View product |
| `models` | Modelos y referencias | Models and references |
| `models_hint` | Indica la cantidad de cada referencia y añádelas al presupuesto. | Enter the quantity of each reference and add them to your quote. |
| `add_selected` | Añadir selección al presupuesto | Add selection to quote |
| `datasheet` | Ficha técnica (PDF) | Datasheet (PDF) |
| `related` | Explora productos similares | Explore similar products |
| `default_item` | Producto (consultar modelo) | Product (model on request) |
| `translation_missing` | Esta ficha aún no está traducida: se muestra el texto en español. | This page is not translated yet: Spanish text is shown. |
| `menu` | Menú | Menu |
| `read_more` | Leer más | Read more |
| `catalog` | Catálogo | Catalogue |
| `catalog_dl` | Descargar catálogo | Download catalogue |
| `lang_banner` | Esta página está disponible en tu idioma. | This page is available in your language. |
| `staging_banner` | Entorno de pruebas — no es la web oficial y no está indexado | Test environment — not the official website and not indexed |
| `css_missing` | La página se ha abierto sin sus estilos (por eso no se ve la imagen de marca). Descomprime el .zip por completo (clic derecho → «Extraer todo») y abre index.html desde la carpeta resultante, o sírvela con «python3 -m http.server». | This page was opened without its styles (so the brand look is missing). Unzip the .zip completely (right-click → “Extract all”) and open index.html from the resulting folder, or serve it with “python3 -m http.server”. |
| `drop_hint` | Arrastra aquí un archivo con columnas «referencia» y «cantidad», o haz clic para elegirlo. | Drop a file with “reference” and “quantity” columns here, or click to choose one. |
| `not_found_title` | Página no encontrada | Page not found |
| `not_found_text` | La dirección no existe o ha cambiado. Puedes volver al inicio, ver los productos o escribirnos. | The address does not exist or has changed. You can go back home, browse the products or write to us. |
| `theme_clasico` | Clásico | Classic |
| `o_related` | Explora productos similares | Explore similar products |
| `o_all_catalog` | Ver todo el catálogo | View full catalog |
| `o_subcats` | Explora las subcategorías | Explore subcategories |
| `o_more` | Más info | Learn more |
| `o_map` | Ver en Google Maps | View on Google Maps |
| `o_tab` | Productos-Torivac | Torivac-Products |
| `o_hint` | Abrir productos | Open products |
| `o_close` | Cerrar el menú de productos | Close the products menu |
| `o_results_n` | Mostrando los {n} resultados | Showing all {n} results |
| `o_zoom` | Ampliar la imagen | Enlarge the image |
| `demo_banner` | Versión de demostración | Demo version |
| `pdf_footer` | Presupuesto orientativo sujeto a confirmación por Torivac. | Indicative quote subject to confirmation by Torivac. |
| `quote_slug` | presupuesto | quote |

## Francés (82 textos a validar; 41 ya existen tal cual en la web original)

| Clave | Español (referencia) | Francés |
|---|---|---|
| `skip` | Saltar al contenido | Aller au contenu |
| `quote_yours` | Tu presupuesto | Votre devis |
| `quote_empty` | Tu presupuesto está vacío. Añade referencias desde cualquier ficha de producto. | Votre devis est vide. Ajoutez des références depuis une fiche produit. |
| `add_to_quote` | Añadir al presupuesto | Ajouter au devis |
| `more_refs` | Más referencias de la tarifa | Autres références du tarif |
| `more_refs_hint` | Códigos de la tarifa vigente que no figuran en la ficha técnica de arriba. | Codes du tarif en vigueur qui ne figurent pas dans la fiche technique ci-dessus. |
| `description_col` | Descripción | Description |
| `ref_model` | Referencia / modelo | Référence / modèle |
| `unit_price` | Precio unidad | Prix unitaire |
| `line_total` | Importe | Montant |
| `total` | Total (sin IVA) | Total (hors TVA) |
| `price_note_request` | Las líneas «Consultar» no suman al total: se presupuestan aparte. | Les lignes « Sur demande » ne sont pas incluses dans le total : elles sont chiffrées séparément. |
| `demo_prices` | Precios de demostración — no son tarifas de Torivac | Prix de démonstration — ne sont pas des tarifs Torivac |
| `price_updated` | Precios actualizados | Prix mis à jour |
| `refresh_prices` | Actualizar precios ahora | Mettre à jour les prix |
| `units` | uds. | pcs |
| `clear` | Vaciar presupuesto | Vider le devis |
| `download_pdf` | Descargar PDF | Télécharger le PDF |
| `send_order` | Enviar pedido | Envoyer la commande |
| `send_hint` | Se enviará a Torivac y recibirás una confirmación por correo. El PDF del presupuesto lo puedes descargar con el otro botón. | Il sera envoyé à Torivac et vous recevrez une confirmation par e-mail. Vous pouvez télécharger le PDF du devis avec l’autre bouton. |
| `demo_send_note` | DEMO: el envío está simulado, no se manda ningún correo real. | DÉMO : l’envoi est simulé, aucun e-mail réel n’est envoyé. |
| `order_sent` | Pedido registrado | Commande enregistrée |
| `order_sent_text` | Hemos generado el presupuesto y el borrador de correo. En producción llegaría a info@ y a mzamora@. | Le devis et le brouillon d’e-mail ont été générés. En production, il arriverait à info@ et mzamora@. |
| `lab_title` | Así regula un variador de tensión | Comment un variateur de tension régule |
| `lab_hint` | Mueve el mando: la tensión de salida baja de 230 V a 0 V. | Déplacez la commande : la tension de sortie passe de 230 V à 0 V. |
| `lab_note` | Ilustración esquemática: onda sinusoidal con valores nominales. | Illustration schématique : onde sinusoïdale à valeurs nominales. |
| `lab_aria` | Osciloscopio esquemático: la onda de salida se reduce al bajar la tensión con el mando. | Oscilloscope schématique : l’onde de sortie diminue quand la commande abaisse la tension. |
| `sending` | Enviando… | Envoi… |
| `send_failed` | No hemos podido enviarlo. Inténtalo de nuevo o escríbenos a | Envoi impossible. Réessayez ou écrivez à |
| `order_received` | Hemos recibido tu pedido y te hemos enviado una confirmación por correo. | Nous avons reçu votre commande et vous avons envoyé une confirmation par e-mail. |
| `order_received_nocopy` | Hemos registrado tu pedido, pero no hemos podido enviarte la confirmación por correo. Guarda el PDF con el botón de abajo y, si no tienes noticias nuestras pronto, escríbenos a | Nous avons enregistré votre commande, mais nous n’avons pas pu vous envoyer la confirmation par e-mail. Enregistrez le PDF avec le bouton ci-dessous et, sans nouvelles de notre part sous peu, écrivez à |
| `message_received` | Mensaje recibido. Te responderemos lo antes posible. | Message reçu. Nous vous répondrons dans les meilleurs délais. |
| `open_email` | Abrir borrador de correo | Ouvrir le brouillon d’e-mail |
| `your_data` | Tus datos | Vos coordonnées |
| `email` | Correo electrónico | E-mail |
| `notes` | Notas para Torivac | Notes pour Torivac |
| `accept_privacy` | He leído y acepto la política de privacidad | J’ai lu et j’accepte la politique de confidentialité |
| `required` | Campo obligatorio | Champ obligatoire |
| `err_plain_text` | Escribe solo texto normal: sin código, etiquetas HTML ni símbolos de programación. | Veuillez saisir du texte simple uniquement : sans code, balises HTML ni symboles de programmation. |
| `err_too_long` | El texto es demasiado largo (máximo {max} caracteres). | Le texte est trop long ({max} caractères maximum). |
| `err_too_many_links` | Incluye como máximo {max} enlaces. | Indiquez {max} liens au maximum. |
| `err_too_fast` | El formulario se ha enviado demasiado rápido. Espera un momento y vuelve a intentarlo. | Le formulaire a été envoyé trop rapidement. Patientez un instant et réessayez. |
| `err_rate` | Demasiados envíos seguidos desde tu conexión. Espera unos minutos e inténtalo de nuevo. | Trop d’envois consécutifs depuis votre connexion. Patientez quelques minutes et réessayez. |
| `chars_left` | Quedan {n} caracteres. | Il reste {n} caractères. |
| `captcha_note` | Este sitio está protegido por Cloudflare Turnstile y se aplican la Política de Privacidad y los Términos del Servicio de Cloudflare. | Ce site est protégé par Cloudflare Turnstile et la Politique de confidentialité et les Conditions d’utilisation de Cloudflare s’appliquent. |
| `captcha_failed` | No hemos podido comprobar que eres una persona. Recarga la página y vuelve a intentarlo; si usas un bloqueador de contenido, desactívalo para esta página. | Nous n’avons pas pu vérifier que vous êtes une personne. Rechargez la page et réessayez ; si vous utilisez un bloqueur de contenu, désactivez-le pour cette page. |
| `categories` | Categorías | Catégories |
| `search_ph` | Buscar por nombre o referencia | Rechercher par nom ou référence |
| `clear_filters` | Quitar filtros | Effacer les filtres |
| `no_results` | No hay productos con estos filtros. | Aucun produit ne correspond à ces filtres. |
| `explore_sub` | Explora las subcategorías | Explorer les sous-catégories |
| `view_category` | Ver categoría | Voir la catégorie |
| `models` | Modelos y referencias | Modèles et références |
| `models_hint` | Indica la cantidad de cada referencia y añádelas al presupuesto. | Indiquez la quantité de chaque référence et ajoutez-les au devis. |
| `add_selected` | Añadir selección al presupuesto | Ajouter la sélection au devis |
| `datasheet` | Ficha técnica (PDF) | Fiche technique (PDF) |
| `related` | Explora productos similares | Découvrez des produits similaires |
| `default_item` | Producto (consultar modelo) | Produit (modèle sur demande) |
| `translation_missing` | Esta ficha aún no está traducida: se muestra el texto en español. | Cette fiche n’est pas encore traduite : le texte espagnol est affiché. |
| `menu` | Menú | Menu |
| `language` | Idioma | Langue |
| `read_more` | Leer más | Lire la suite |
| `lang_banner` | Esta página está disponible en tu idioma. | Cette page est disponible dans votre langue. |
| `lang_switch` | Cambiar | Changer |
| `staging_banner` | Entorno de pruebas — no es la web oficial y no está indexado | Environnement de test — ce n’est pas le site officiel et il n’est pas indexé |
| `css_missing` | La página se ha abierto sin sus estilos (por eso no se ve la imagen de marca). Descomprime el .zip por completo (clic derecho → «Extraer todo») y abre index.html desde la carpeta resultante, o sírvela con «python3 -m http.server». | La page s’est ouverte sans ses styles (l’identité visuelle n’apparaît donc pas). Décompressez entièrement le .zip (clic droit → « Extraire tout ») et ouvrez index.html depuis le dossier obtenu, ou servez-le avec « python3 -m http.server ». |
| `drop_hint` | Arrastra aquí un archivo con columnas «referencia» y «cantidad», o haz clic para elegirlo. | Déposez ici un fichier avec les colonnes « référence » et « quantité », ou cliquez pour le choisir. |
| `not_found_title` | Página no encontrada | Page introuvable |
| `not_found_text` | La dirección no existe o ha cambiado. Puedes volver al inicio, ver los productos o escribirnos. | L’adresse n’existe pas ou a changé. Vous pouvez revenir à l’accueil, voir les produits ou nous écrire. |
| `theme` | Aspecto | Apparence |
| `theme_clasico` | Clásico | Classique |
| `o_related` | Explora productos similares | Découvrez des produits similaires |
| `o_all_catalog` | Ver todo el catálogo | Voir tout le catalogue |
| `o_subcats` | Explora las subcategorías | Explorer les sous-catégories |
| `o_map` | Ver en Google Maps | Voir sur Google Maps |
| `o_tab` | Productos-Torivac | Produits-Torivac |
| `o_hint` | Abrir productos | Ouvrir les produits |
| `o_close` | Cerrar el menú de productos | Fermer le menu des produits |
| `o_results_n` | Mostrando los {n} resultados | Affichage des {n} résultats |
| `o_zoom` | Ampliar la imagen | Agrandir l’image |
| `demo_banner` | Versión de demostración | Version de démonstration |
| `pdf_footer` | Presupuesto orientativo sujeto a confirmación por Torivac. | Devis indicatif soumis à confirmation par Torivac. |

## Alemán (86 textos a validar; 37 ya existen tal cual en la web original)

| Clave | Español (referencia) | Alemán |
|---|---|---|
| `skip` | Saltar al contenido | Zum Inhalt springen |
| `quote_yours` | Tu presupuesto | Ihr Angebot |
| `quote_empty` | Tu presupuesto está vacío. Añade referencias desde cualquier ficha de producto. | Ihr Angebot ist leer. Fügen Sie Artikel auf einer Produktseite hinzu. |
| `add_to_quote` | Añadir al presupuesto | Zum Angebot hinzufügen |
| `added` | Añadido | Hinzugefügt |
| `ref` | Referencia | Artikelnummer |
| `more_refs` | Más referencias de la tarifa | Weitere Artikel der Preisliste |
| `more_refs_hint` | Códigos de la tarifa vigente que no figuran en la ficha técnica de arriba. | Artikelnummern der aktuellen Preisliste, die nicht im Datenblatt oben stehen. |
| `description_col` | Descripción | Beschreibung |
| `ref_model` | Referencia / modelo | Artikelnr. / Modell |
| `unit_price` | Precio unidad | Stückpreis |
| `line_total` | Importe | Betrag |
| `total` | Total (sin IVA) | Gesamt (ohne MwSt.) |
| `price_note_request` | Las líneas «Consultar» no suman al total: se presupuestan aparte. | Positionen „Auf Anfrage“ sind nicht in der Summe enthalten und werden separat angeboten. |
| `demo_prices` | Precios de demostración — no son tarifas de Torivac | Demo-Preise — keine Torivac-Preise |
| `price_updated` | Precios actualizados | Preise aktualisiert |
| `refresh_prices` | Actualizar precios ahora | Preise jetzt aktualisieren |
| `tier_from` | desde | ab |
| `units` | uds. | Stk. |
| `clear` | Vaciar presupuesto | Angebot leeren |
| `download_pdf` | Descargar PDF | PDF herunterladen |
| `send_order` | Enviar pedido | Bestellung senden |
| `send_hint` | Se enviará a Torivac y recibirás una confirmación por correo. El PDF del presupuesto lo puedes descargar con el otro botón. | Wird an Torivac gesendet, und Sie erhalten eine Bestätigung per E-Mail. Das Angebots-PDF können Sie mit der anderen Schaltfläche herunterladen. |
| `demo_send_note` | DEMO: el envío está simulado, no se manda ningún correo real. | DEMO: Der Versand ist simuliert, es wird keine echte E-Mail gesendet. |
| `order_sent` | Pedido registrado | Bestellung erfasst |
| `order_sent_text` | Hemos generado el presupuesto y el borrador de correo. En producción llegaría a info@ y a mzamora@. | Angebot und E-Mail-Entwurf wurden erstellt. In Produktion ginge es an info@ und mzamora@. |
| `lab_title` | Así regula un variador de tensión | So regelt ein Spannungsregler |
| `lab_hint` | Mueve el mando: la tensión de salida baja de 230 V a 0 V. | Regler bewegen: die Ausgangsspannung sinkt von 230 V auf 0 V. |
| `lab_note` | Ilustración esquemática: onda sinusoidal con valores nominales. | Schematische Darstellung: Sinuswelle mit Nennwerten. |
| `lab_aria` | Osciloscopio esquemático: la onda de salida se reduce al bajar la tensión con el mando. | Schematisches Oszilloskop: die Ausgangswelle wird kleiner, wenn der Regler die Spannung senkt. |
| `sending` | Enviando… | Wird gesendet… |
| `send_failed` | No hemos podido enviarlo. Inténtalo de nuevo o escríbenos a | Senden fehlgeschlagen. Bitte erneut versuchen oder schreiben an |
| `order_received` | Hemos recibido tu pedido y te hemos enviado una confirmación por correo. | Wir haben Ihre Bestellung erhalten und Ihnen eine Bestätigung per E-Mail gesendet. |
| `order_received_nocopy` | Hemos registrado tu pedido, pero no hemos podido enviarte la confirmación por correo. Guarda el PDF con el botón de abajo y, si no tienes noticias nuestras pronto, escríbenos a | Wir haben Ihre Bestellung erfasst, konnten Ihnen aber keine Bestätigung per E-Mail senden. Speichern Sie das PDF mit der Schaltfläche unten und schreiben Sie, falls Sie bald nichts von uns hören, an |
| `message_received` | Mensaje recibido. Te responderemos lo antes posible. | Nachricht erhalten. Wir antworten Ihnen in Kürze. |
| `open_email` | Abrir borrador de correo | E-Mail-Entwurf öffnen |
| `your_data` | Tus datos | Ihre Angaben |
| `notes` | Notas para Torivac | Hinweise an Torivac |
| `accept_privacy` | He leído y acepto la política de privacidad | Ich habe die Datenschutzrichtlinie gelesen und akzeptiere sie |
| `required` | Campo obligatorio | Pflichtfeld |
| `err_plain_text` | Escribe solo texto normal: sin código, etiquetas HTML ni símbolos de programación. | Bitte nur normalen Text eingeben: kein Code, keine HTML-Tags und keine Programmiersymbole. |
| `err_too_long` | El texto es demasiado largo (máximo {max} caracteres). | Der Text ist zu lang (höchstens {max} Zeichen). |
| `err_too_many_links` | Incluye como máximo {max} enlaces. | Bitte höchstens {max} Links angeben. |
| `err_too_fast` | El formulario se ha enviado demasiado rápido. Espera un momento y vuelve a intentarlo. | Das Formular wurde zu schnell abgeschickt. Bitte kurz warten und erneut versuchen. |
| `err_rate` | Demasiados envíos seguidos desde tu conexión. Espera unos minutos e inténtalo de nuevo. | Zu viele Absendungen von Ihrer Verbindung. Bitte einige Minuten warten und erneut versuchen. |
| `chars_left` | Quedan {n} caracteres. | Noch {n} Zeichen. |
| `captcha_note` | Este sitio está protegido por Cloudflare Turnstile y se aplican la Política de Privacidad y los Términos del Servicio de Cloudflare. | Diese Website ist durch Cloudflare Turnstile geschützt; es gelten die Datenschutzerklärung und die Nutzungsbedingungen von Cloudflare. |
| `captcha_failed` | No hemos podido comprobar que eres una persona. Recarga la página y vuelve a intentarlo; si usas un bloqueador de contenido, desactívalo para esta página. | Wir konnten nicht prüfen, ob Sie ein Mensch sind. Laden Sie die Seite neu und versuchen Sie es erneut; wenn Sie einen Inhaltsblocker verwenden, schalten Sie ihn für diese Seite aus. |
| `categories` | Categorías | Kategorien |
| `home` | Inicio | Startseite |
| `search_ph` | Buscar por nombre o referencia | Nach Name oder Artikelnummer suchen |
| `clear_filters` | Quitar filtros | Filter zurücksetzen |
| `no_results` | No hay productos con estos filtros. | Keine Produkte für diese Filter. |
| `explore_sub` | Explora las subcategorías | Unterkategorien erkunden |
| `view_category` | Ver categoría | Kategorie ansehen |
| `view_product` | Ver ficha | Produkt ansehen |
| `models` | Modelos y referencias | Modelle und Artikelnummern |
| `models_hint` | Indica la cantidad de cada referencia y añádelas al presupuesto. | Geben Sie die Menge je Artikelnummer ein und fügen Sie sie dem Angebot hinzu. |
| `add_selected` | Añadir selección al presupuesto | Auswahl zum Angebot hinzufügen |
| `datasheet` | Ficha técnica (PDF) | Datenblatt (PDF) |
| `related` | Explora productos similares | Ähnliche Produkte entdecken |
| `default_item` | Producto (consultar modelo) | Produkt (Modell auf Anfrage) |
| `translation_missing` | Esta ficha aún no está traducida: se muestra el texto en español. | Diese Seite ist noch nicht übersetzt: Es wird der spanische Text angezeigt. |
| `back_to_top` | Subir | Nach oben |
| `read_more` | Leer más | Weiterlesen |
| `blog_table` | Tabla | Tabelle |
| `lang_banner` | Esta página está disponible en tu idioma. | Diese Seite ist in Ihrer Sprache verfügbar. |
| `staging_banner` | Entorno de pruebas — no es la web oficial y no está indexado | Testumgebung — nicht die offizielle Website und nicht indexiert |
| `css_missing` | La página se ha abierto sin sus estilos (por eso no se ve la imagen de marca). Descomprime el .zip por completo (clic derecho → «Extraer todo») y abre index.html desde la carpeta resultante, o sírvela con «python3 -m http.server». | Die Seite wurde ohne ihre Stile geöffnet (daher fehlt das Markenbild). Entpacken Sie die ZIP-Datei vollständig (Rechtsklick → „Alle extrahieren“) und öffnen Sie index.html im entstandenen Ordner oder starten Sie «python3 -m http.server». |
| `drop_hint` | Arrastra aquí un archivo con columnas «referencia» y «cantidad», o haz clic para elegirlo. | Datei mit den Spalten „Artikelnummer“ und „Menge“ hierher ziehen oder klicken. |
| `not_found_title` | Página no encontrada | Seite nicht gefunden |
| `not_found_text` | La dirección no existe o ha cambiado. Puedes volver al inicio, ver los productos o escribirnos. | Die Adresse existiert nicht oder hat sich geändert. Sie können zur Startseite zurückkehren, die Produkte ansehen oder uns schreiben. |
| `theme` | Aspecto | Darstellung |
| `theme_clasico` | Clásico | Klassisch |
| `theme_original` | Original | Original |
| `o_related` | Explora productos similares | Ähnliche Produkte erkunden |
| `o_all_catalog` | Ver todo el catálogo | Gesamten Katalog ansehen |
| `o_subcats` | Explora las subcategorías | Unterkategorien erkunden |
| `o_map` | Ver en Google Maps | Auf Google Maps ansehen |
| `o_tab` | Productos-Torivac | Torivac-Produkte |
| `o_hint` | Abrir productos | Produkte öffnen |
| `o_close` | Cerrar el menú de productos | Produktmenü schließen |
| `o_results_n` | Mostrando los {n} resultados | Alle {n} Ergebnisse werden angezeigt |
| `o_zoom` | Ampliar la imagen | Bild vergrößern |
| `demo_banner` | Versión de demostración | Demoversion |
| `pdf_footer` | Presupuesto orientativo sujeto a confirmación por Torivac. | Unverbindliches Angebot, vorbehaltlich der Bestätigung durch Torivac. |
