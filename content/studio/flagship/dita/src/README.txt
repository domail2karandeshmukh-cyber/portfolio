A DITA 1.3 project made by the workbench at karandeshmukh.dev.

mp-ps104-01.ditamap  the map: the title, the metadata, a key for each variable, and the topic
topics/mp-ps104-01.dita  the task topic

To publish it with DITA Open Toolkit 4:

  dita --input=mp-ps104-01.ditamap --format=html5 --output=out/html5
  dita --input=mp-ps104-01.ditamap --format=pdf --output=out/pdf
