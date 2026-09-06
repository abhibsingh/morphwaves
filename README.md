# Morphwaves website

This repository contains the prebuilt static website downloaded from Netlify, not the original Next.js source project.

The footer address and mailto link have been updated to Abhishek@Morphwaves.in in both index.html and the application JavaScript chunk.

## Deploy using GitHub and the existing Netlify project

1. Upload all contents of this folder to the root of a GitHub repository. Include the _next directory. Upload extracted files, not the ZIP.
2. In the existing morphwave Netlify project, open Project configuration > Build & deploy > Continuous deployment and link the GitHub repository.
3. Select the repository branch. Leave the build command empty and set the publish directory to a single dot (.). No npm build is required for these prebuilt files.
4. Deploy and verify the footer text and email link on morphwaves.com.

Keep the existing Netlify project to preserve its domain configuration. Future pushes to the linked branch trigger deployment.

For substantial development, recover the original Next.js source. Editing these generated files does not update that source; rebuilding from an older source could restore the old address.

Netlify documentation: https://docs.netlify.com/build/configure-builds/overview/
