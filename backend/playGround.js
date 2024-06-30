let b = 1;
function Function({a}) {
    b += 1;
    console.log(`a = ${a}`);
}

Function(b)
console.log(b);