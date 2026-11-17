A DITA 1.3 project made at karandeshmukh.dev/studio/dita.

developer-documentation.ditamap  the map: 4 topic(s), 4 key(s), and a relationship table
topics/  one topic for each document

To publish it with DITA Open Toolkit 4:

  dita --input=developer-documentation.ditamap --format=html5 --output=out/html5
  dita --input=developer-documentation.ditamap --format=pdf --output=out/pdf

To bring it into MadCap Flare: Project > Import > DITA Document Set, and choose the map.
