# WarLike Node — Compositing & graphes v2

Éditeur autonome de compositing dans le navigateur. **WarLike Engine reste indépendant et n'a pas été modifié.**

## Fonctionnalités actuelles

- **Graphe multi-entrées :** ports nommés et fusion de deux couches (« background » + « foreground ») avec opacité et modes source-over, multiply, screen, overlay et lighter. Plusieurs sources image indépendantes par nœud ; connecte chaque source au bon port.
- **Masques :** masque elliptique à centre, rayons, adoucissement de contour et inversion ; **détourage chroma** sur une couleur définie avec seuil et transition.
- **Sources vidéo :** chargement local d'une vidéo décodable par le navigateur, recherche temporelle sur timeline et rendu frame par frame en Canvas2D. Le média n'est pas envoyé au serveur.
- **Keyframes :** une suite de points temporels pour les paramètres numériques des nœuds, et interpolation linéaire, douce (smoothstep) ou maintenue (« hold »). Les clés sont conservées dans le JSON.
- **GPU :** nœud « Shader GPU couleurs » implémenté en WebGL2 pour les trois canaux RGB. Repli CPU Canvas2D indiqué lorsque WebGL2 est indisponible. Les autres effets fonctionnent sur Canvas2D.
- **Effets image :** luminosité, contraste, saturation, noir et blanc, flou, teinte, masquage, chroma key et compositing.
- **Exports :** PNG du rendu courant ; WebM vidéo seule et en temps réel par MediaRecorder (expérimental, aucun son) ; export JSON du graphe et manifeste `warlike-node-effect` pour l'intégration WarLike.
- **Persistence :** graphe, liens, images clés, FPS et durée stockés dans localStorage. Lecture des anciens graphes `warlike-node-v1` avec migration vers v2. Les fichiers image et vidéo ne sont pas inclus dans le JSON.

## Prise en main

1. Ajouter deux nœuds « Source image » et importer **une image différente sur chacun**.
2. Ajouter « Fusion couches ». Relier les sources aux ports « background » et « foreground ». Relier la sortie Fusion à la Sortie.
3. Ajouter un masque ou un nœud « Détourage couleur » sur une des branches pour obtenir une vraie transparence.
4. Définir la durée et le temps de la timeline, choisir un nœud possédant des paramètres numériques, et cliquer sur « Ajouter une image clé ». Modifier les paramètres sur différents temps.
5. Charger une vidéo dans un nœud « Source vidéo » si nécessaire. Exporter le rendu courant en PNG ou essayer l'export WebM vidéo seule.

Serveur statique : `python3 -m http.server 8080` puis ouvrir `http://localhost:8080`.

## Échange avec WarLike Monteur

Le bouton **Effet pour Monteur / Studio** crée un manifeste JSON versionné. **WarLike Monteur dispose maintenant d'un import dans l'inspecteur de clip** pour les graphes linéaires de correction couleur seulement (brightness, contrast, saturation, grayscale). Les compositions multicouches, masques, vidéo, GPU et keyframes ne sont **pas** interprétés par cet adaptateur : il les refuse explicitement. Aucun transfert direct des vidéos entre les applications n'est réalisé.

**WarLike Studio :** format d'échange documenté, mais **aucun moteur audio à nœuds ni importeur de graphes Node opérationnel dans Studio** n'a encore été mis en place. Une intégration audio native nécessitera des types de nœuds audio distincts et un adaptateur d'effets compatible avec Studio ; ne pas confondre le manifeste avec une connexion fonctionnelle.

## Tests et limites

- Tests unitaires : `npm test` — vérifient la migration v1, les connexions multi-entrées, le rejet des cycles, l'interpolation et le contrat JSON.
- Tests Chromium : `npm run test:browser` — chargement de graphes, PNG et essai d'export WebM à partir d'une vidéo générée par FFmpeg, vérification de la piste vidéo avec FFprobe.
- GitHub Actions : `.github/workflows/node-validation.yml`. L'exécution **réussie** de ce workflow et une QA tactile sur les appareils ciblés restent à confirmer.

**Limites techniques :** une seule vidéo active par session, plusieurs sources image fixes ; aucun audio dans le WebM, pas de rendu hors temps réel, pas de courbes de Bézier paramétrables, pas de masques vectoriels dessinés à la main ou de rotoscopie, pas de tracking, ni de compositing 4K. Les traitements opèrent à **640 × 360**. Le contrôle de l'export WebM et des codecs dépend du navigateur. Sur certains navigateurs, le traitement WebGL2 peut nécessiter des adaptations supplémentaires.

## Prochaines étapes

Pistes audio, import direct dans WarLike Studio, formats de graphes partagés, vidéos multi-sources avec synchronisation, courbes de Bézier avancées et rendu GPU composité de bout en bout.
