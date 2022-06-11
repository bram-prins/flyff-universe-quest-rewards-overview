const arr = [null, 1, 2, null, 3, 2, 3]
console.log([...arr].sort((a,b) => {
	if (a && b) return b - a
	else if (a) return -1;
	else if (b) return 1;
	else return 0;
}))