A DITA 1.3 project made at karandeshmukh.dev/studio/dita.

acme-console-help.ditamap  the map: 6 topic(s), 2 key(s), and a relationship table
topics/  one topic for each document
filters/  one DITAVAL file for each group of readers, and general.ditaval for readers in no group

To publish it with DITA Open Toolkit 4:

  dita --input=acme-console-help.ditamap --format=html5 --output=out/html5 --filter=filters/general.ditaval
  dita --input=acme-console-help.ditamap --format=pdf --output=out/pdf

To bring it into MadCap Flare: Project > Import > DITA Document Set, and choose the map.
