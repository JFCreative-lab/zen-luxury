import * as pulumi from "@pulumi/pulumi";

// Zen Luxury webshop — hosted on GitHub Pages.
//
// The actual deployment is handled by the GitHub Actions workflow at
// .github/workflows/deploy.yml, which publishes the www/ directory to
// GitHub Pages on every push to the zen-luxury branch.
//
// No cloud provider credentials are required to manage this stack.

const config   = new pulumi.Config();
const org      = config.get("githubOrg")  ?? "JFCreative-lab";
const repo     = config.get("githubRepo") ?? "zen-luxury";

// GitHub Pages URL follows the pattern: https://<org>.github.io/<repo>
export const siteUrl          = `https://${org.toLowerCase()}.github.io/${repo}`;
export const deploymentMethod = "GitHub Pages via GitHub Actions";
export const sourceDirectory  = "www/";
