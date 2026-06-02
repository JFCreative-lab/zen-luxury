import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";
import * as path from "path";

// ──────────────────────────────────────────────────────────────
// MIME type map for all extensions used by the static site.
// ──────────────────────────────────────────────────────────────
const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] ?? "application/octet-stream";
}

// Recursively walk a directory and return absolute paths for all files.
function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// ──────────────────────────────────────────────────────────────
// S3 BUCKET  (private — served exclusively through CloudFront)
// ──────────────────────────────────────────────────────────────
const bucket = new aws.s3.BucketV2("zen-luxury-site", {
  tags: { Project: "zen-luxury", ManagedBy: "Pulumi" },
});

// Enforce private access; CloudFront OAC handles delivery.
const bucketPab = new aws.s3.BucketPublicAccessBlock("zen-luxury-pab", {
  bucket: bucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// ──────────────────────────────────────────────────────────────
// CLOUDFRONT  (with Origin Access Control — modern, secure)
// ──────────────────────────────────────────────────────────────
const oac = new aws.cloudfront.OriginAccessControl("zen-luxury-oac", {
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

const distribution = new aws.cloudfront.Distribution("zen-luxury-cdn", {
  enabled: true,
  defaultRootObject: "index.html",
  comment: "Zen Luxury webshop CDN",
  origins: [
    {
      originId: "s3-origin",
      domainName: bucket.bucketRegionalDomainName,
      originAccessControlId: oac.id,
    },
  ],
  defaultCacheBehavior: {
    targetOriginId: "s3-origin",
    viewerProtocolPolicy: "redirect-to-https",
    compress: true,
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD"],
    forwardedValues: {
      queryString: false,
      cookies: { forward: "none" },
    },
    minTtl: 0,
    defaultTtl: 3600,    // 1 hour for HTML pages
    maxTtl: 86400,       // 24 hours max
  },
  // Long-lived cache for versioned assets (CSS/JS under assets/)
  orderedCacheBehaviors: [
    {
      pathPattern: "/assets/*",
      targetOriginId: "s3-origin",
      viewerProtocolPolicy: "redirect-to-https",
      compress: true,
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      forwardedValues: {
        queryString: false,
        cookies: { forward: "none" },
      },
      minTtl: 0,
      defaultTtl: 31536000,  // 1 year for static assets
      maxTtl: 31536000,
    },
  ],
  // Return index.html for SPA-style 403/404 from S3
  customErrorResponses: [
    {
      errorCode: 403,
      responseCode: 200,
      responsePagePath: "/index.html",
      errorCachingMinTtl: 10,
    },
    {
      errorCode: 404,
      responseCode: 404,
      responsePagePath: "/index.html",
      errorCachingMinTtl: 10,
    },
  ],
  restrictions: {
    geoRestriction: { restrictionType: "none" },
  },
  viewerCertificate: {
    cloudfrontDefaultCertificate: true,
  },
  tags: { Project: "zen-luxury", ManagedBy: "Pulumi" },
});

// ──────────────────────────────────────────────────────────────
// BUCKET POLICY  — grants CloudFront OAC read access
// ──────────────────────────────────────────────────────────────
const bucketPolicy = new aws.s3.BucketPolicy(
  "zen-luxury-bucket-policy",
  {
    bucket: bucket.id,
    policy: pulumi
      .all([bucket.arn, distribution.arn])
      .apply(([bucketArn, distArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AllowCloudFrontServicePrincipal",
              Effect: "Allow",
              Principal: { Service: "cloudfront.amazonaws.com" },
              Action: "s3:GetObject",
              Resource: `${bucketArn}/*`,
              Condition: {
                StringEquals: { "AWS:SourceArn": distArn },
              },
            },
          ],
        })
      ),
  },
  { dependsOn: [bucketPab] }
);

// ──────────────────────────────────────────────────────────────
// STATIC ASSETS  — upload every file from www/ to S3
// ──────────────────────────────────────────────────────────────
const wwwDir = path.join(__dirname, "www");

for (const filePath of walkDir(wwwDir)) {
  // Use the path relative to www/ as the S3 key (forward slashes on all platforms)
  const key = path.relative(wwwDir, filePath).split(path.sep).join("/");

  // Versioned assets get an immutable cache; HTML pages get a short-lived one
  const cacheControl = key.startsWith("assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600, must-revalidate";

  new aws.s3.BucketObjectv2(
    `site-file-${key}`,
    {
      bucket: bucket.id,
      key,
      source: new pulumi.asset.FileAsset(filePath),
      contentType: getMimeType(filePath),
      cacheControl,
    },
    { dependsOn: [bucketPolicy] }
  );
}

// ──────────────────────────────────────────────────────────────
// STACK OUTPUTS
// ──────────────────────────────────────────────────────────────
export const bucketName     = bucket.bucket;
export const cdnUrl         = pulumi.interpolate`https://${distribution.domainName}`;
export const distributionId = distribution.id;
