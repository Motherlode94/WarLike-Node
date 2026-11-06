# WarLike Node

Éditeur de compositing à nœuds **autonome** pour l'écosystème WarLike. Fonctionne dans un navigateur récent avec Canvas 2D et sans dépendances externes.

## Première version

- Graphe de traitement visuel : création, sélection, déplacement et suppression de nœuds.
- Connexions par ports : cliquer sur une sortie puis sur l'entrée voulue. Une seule connexion entrante par nœud ; cycles interdits.
- **Effets réels** : source PNG/JPEG/WebP, luminosité, contraste, saturation, noir et blanc, flou et teinte colorée, sortie.
- Prévisualisation calculée dans le navigateur en 640 × 360, export PNG du résultat.
- Export/import JSON des nœuds, positions, paramètres et connexions, avec validation des graphes et sauvegarde automatique dans localStorage.
- Une image de démonstration générée par Canvas est disponible pour vérifier les filtres sans charger de fichier.
- Interface adaptée au mobile ; le déplacement des nœuds reste davantage destiné à la souris ou à un écran tactile large.

## Utilisation

Lancer un serveur statique depuis le dépôt :

```sh
python -m http.server 8080
```

Ouvrir `http://localhost:8080`. Le graphe initial contient Source → Contraste → Sortie. Sélectionner **Source image**, importer une image, ajouter des nœuds et les relier. Cliquer sur **Exporter PNG** pour obtenir le rendu.

L'import d'un graphe ne contient **pas les fichiers image** : il faut réimporter le média source. L'application ne transfère aucun fichier vers un serveur.

## Limites

Cette version traite des **images fixes**, pas encore des flux vidéo. Elle n'intègre ni graphe GPU, ni shader GLSL, ni nœuds audio, ni masques, ni nœuds de composition multi-entrées, ni moteur de rendu temps réel. Chaque nœud dispose d'une seule entrée visuelle. Les effets utilisent les filtres Canvas 2D du navigateur ; la sortie est limitée à 640 × 360. Les graphes sont limités à 40 nœuds et 80 connexions.

La syntaxe JavaScript et la cohérence des références d'interface ont été vérifiées ; les tests manuels navigateur/tactiles et la publication Cloudflare doivent encore être réalisés.

WarLike Node est un projet distinct. **WarLike Engine n'a pas été modifié**.
