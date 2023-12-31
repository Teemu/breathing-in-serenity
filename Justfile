set dotenv-load
set positional-arguments

# Run & watch for changes
run:
    npx w4 watch

# Install dependencies
install:
    npm install

build:
    npm run build
    npx w4 bundle build/cart.wasm --title "Breathing in Serenity" --html build/breathing-in-serenity.html --icon-file "favicon.ico" --html-template src/template.html

deploy:
    just build
    git checkout gh-pages
    cp build/breathing-in-serenity.html index.html
    git add index.html && git commit -m "Build gh-pages"
    git push origin gh-pages
    git checkout main
