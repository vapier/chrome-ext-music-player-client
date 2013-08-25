CLOSURE = closure-compiler --language_in ECMASCRIPT5

all:

%.js.min: %.js
	$(CLOSURE) $< > $@

JS_FILES = $(shell grep '[.]js$$' manifest.files)
js-min: $(JS_FILES:=.min)

check: js-min

.PHONY: all clean check js-min
