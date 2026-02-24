const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ZipWebpackPlugin = require('zip-webpack-plugin');

module.exports = {
    entry: {
        index: './src/index.js'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: "commonjs2",
        library: {
            type: "commonjs2",
        },
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            },
            {
                test: /\.js$/,
                use: {
                    loader: 'esbuild-loader',
                    options: {
                        target: 'es2015'
                    }
                }
            }
        ]
    },
    // 关键：使用 externals 让 siyuan 模块从全局变量获取
    externals: {
        siyuan: "siyuan"
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css'
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'plugin.json', to: 'plugin.json' },
                { from: 'i18n', to: 'i18n' },
                { from: 'icon.png', to: 'icon.png' },
                { from: 'README.md', to: 'README.md' },
                { from: 'README_zh_CN.md', to: 'README_zh_CN.md' }
            ]
        }),
        new ZipWebpackPlugin({
            filename: 'package.zip',
            path: path.resolve(__dirname)
        })
    ]
};
