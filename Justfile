set dotenv-load
set positional-arguments

# Run & watch for changes
run:
    npx w4 watch

# Install dependencies
install:
    npm install

build:
    npx w4 bundle build/cart.wasm --title "Breathing in Serenity" --html build/breathing-in-serenity.html