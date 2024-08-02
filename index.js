#!/usr/bin/env node
import 'node-fetch';
import Table from 'cli-table3';



import { program } from "commander";

const githubApiUrl = 'https://api.github.com';
const headers = {
  'Accept': 'application/vnd.github.v3+json'
};

program
  .version("1.0.0")
  .description("Produce repo stats for an org you own")
  .option("-t, --token <type>", "Provide your github token")
  .option("-o, --org <org>", "Provide your org name")
  .action((options) => {
    main(options.token, options.org);

    console.log(`Loading data....!`);
  });

program.parse(process.argv);

async function getRepos(orgName, token) {
  try {
    const reposUrl = `${githubApiUrl}/orgs/${orgName}/repos`
    console.log(reposUrl)
    const response = await fetch(reposUrl, { ...headers, 'Authorization': `token ${token}`, });
    if (!response.ok) {
      throw new Error(`Error fetching repositories: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function getRepoDetails(repo) {
  try {
    const [repoResponse, clonesResponse, viewsResponse, prsResponse, issuesResponse] = await Promise.all([
      fetch(`${githubApiUrl}/repos/${repo.full_name}`, { headers }),
      fetch(`${githubApiUrl}/repos/${repo.full_name}/traffic/clones`, { headers }),
      fetch(`${githubApiUrl}/repos/${repo.full_name}/traffic/views`, { headers }),
      fetch(`${githubApiUrl}/repos/${repo.full_name}/pulls?state=open`, { headers }),
      fetch(`${githubApiUrl}/repos/${repo.full_name}/issues?state=open`, { headers })
    ]);

    if (!repoResponse.ok) throw new Error(`Error fetching repo details for ${repo.name}: ${repoResponse.statusText}`);
    if (!clonesResponse.ok) throw new Error(`Error fetching clone details for ${repo.name}: ${clonesResponse.statusText}`);
    if (!viewsResponse.ok) throw new Error(`Error fetching view details for ${repo.name}: ${viewsResponse.statusText}`);
    if (!prsResponse.ok) throw new Error(`Error fetching pull requests for ${repo.name}: ${prsResponse.statusText}`);
    if (!issuesResponse.ok) throw new Error(`Error fetching issues for ${repo.name}: ${issuesResponse.statusText}`);

    const repoData = await repoResponse.json();
    const clonesData = await clonesResponse.json();
    const viewsData = await viewsResponse.json();
    const prsData = await prsResponse.json();
    const issuesData = await issuesResponse.json();

    return {
      name: repo.name,
      forks: repoData.forks_count,
      stars: repoData.stargazers_count,
      clones: `${clonesData.count} (${clonesData.uniques} unique)`,
      visitors: `${viewsData.count} (${viewsData.uniques} unique)`,
      uniqueClones: clonesData.uniques,
      uniqueVisitors: viewsData.uniques,
      openPRs: prsData.length,
      openIssues: issuesData.length
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}
async function main(token, org) {
  const repos = await getRepos(org, token);

  const repoDetailsPromises = repos.map(repo => getRepoDetails(repo));
  const repoDetails = await Promise.all(repoDetailsPromises);

  const table = new Table({
    head: ['Project', 'Stars', 'Forks', 'Git Clones L30D', 'Visitors L30D', 'Open PRs', 'Open Issues'],
    colWidths: [30, 10, 10, 20, 20, 10, 10]
  });

  repoDetails.forEach(details => {
    if (details) {
      table.push([
        details.name,
        details.stars,
        details.forks,
        details.clones,
        details.visitors,
        details.openPRs,
        details.openIssues
      ]);
    }
  });

  console.log(table.toString());
}