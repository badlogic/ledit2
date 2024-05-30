import fs from "fs";
import path from "path";
import cheerio from "cheerio";

interface Article {
    link: string;
    date: string;
    title: string;
    subtitle: string;
    posts: number;
}

const directoryPath = "data/babler";
const outputFilePath = path.join(directoryPath, "babler.json");

fs.readdir(directoryPath, (err, files) => {
    if (err) throw err;

    const articles: Article[] = [];

    files
        .filter((file) => file.endsWith(".html"))
        .forEach((file) => {
            const filePath = path.join(directoryPath, file);
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const $ = cheerio.load(fileContent);
            const articleElements = $("article");

            articleElements.each((_, element) => {
                const linkElement = $(element).find("a");
                const link = linkElement.attr("href") || "";
                const dateElement = $(element).find("header time");
                const date = dateElement.attr("datetime") || "";
                const titleElement = $(element).find("h1.teaser-title");
                const title = titleElement.text().replace(/\s+/g, " ").trim();
                const subtitleElement = $(element).find("p.teaser-subtitle");
                const subtitle = subtitleElement.text().replace(/\s+/g, " ").trim();
                const postsElement = $(element).find("div.teaser-postingcount");
                const postsText = postsElement.text().trim().split(" ")[0].replace(".", "");
                const posts = postsText.length == 0 ? 0 : parseInt(postsText, 10);

                articles.push({ link, date, title, subtitle, posts });
            });
        });

    articles.sort((a, b) => b.posts - a.posts);

    fs.writeFileSync(outputFilePath, JSON.stringify(articles, null, 2), "utf-8");
});
