swapPeriodsAndCommas = (str) =>  {
    let result = '';
    for (let char of str) {
        if (char === ',') {
            result += '.';
        } else if (char === '.') {
            result += ',';
        } else {
            result += char;
        }
    }
}


export {swapPeriodsAndCommas}