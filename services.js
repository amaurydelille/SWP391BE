function editDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    const dp = [];
    for (let i = 0; i <= m; i++) {
        dp[i] = [];
        for (let j = 0; j <= n; j++) {
            if (i === 0) {
                dp[i][j] = j;
            } else if (j === 0) {
                dp[i][j] = i;
            } else if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i][j - 1],
                    dp[i - 1][j],
                    dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}

function merge(arr1, arr2) {
    const result = [...arr1];

    for (const item of arr2) {
        if (!result.includes(item))
            result.push(item);
    }
    return result;
}


module.exports = { editDistance, merge };