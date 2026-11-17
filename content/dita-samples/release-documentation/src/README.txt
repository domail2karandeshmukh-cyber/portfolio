A DITA 1.3 project made at karandeshmukh.dev/studio/dita.

release-documentation.ditamap  the map: 3 topic(s), 3 key(s), and a relationship table
topics/  one topic for each document

To publish it with DITA Open Toolkit 4:

  dita --input=release-documentation.ditamap --format=html5 --output=out/html5
  dita --input=release-documentation.ditamap --format=pdf --output=out/pdf

To bring it into MadCap Flare: Project > Import > DITA Document Set, and choose the map.
