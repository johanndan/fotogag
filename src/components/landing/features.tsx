import {
  CloudIcon,
  BoltIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  EnvelopeIcon,
  CommandLineIcon,
  SunIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

const features = [
  {
    name: "AI Photo Restoration",
    description:
      "Bring old, damaged photos back to life with advanced AI algorithms that repair scratches, restore colors, and enhance details automatically.",
    icon: ShieldCheckIcon,
  },
  {
    name: "Age Transformation",
    description:
      "See yourself or loved ones at different ages with our powerful AI age transformation technology - younger, older, or anywhere in between.",
    icon: EnvelopeIcon,
  },
  {
    name: "Magic AI Effects",
    description:
      "Transform your photos with stunning AI-powered filters, artistic styles, and magical effects with just one click.",
    icon: BoltIcon,
  },
  {
    name: "Smart Object Removal",
    description:
      "Remove unwanted objects, people, or backgrounds from your photos seamlessly with AI-powered content-aware fill technology.",
    icon: SunIcon,
  },
  {
    name: "Instant Enhancements",
    description:
      "Automatically enhance lighting, colors, and composition with AI-powered photo optimization for professional-looking results.",
    icon: CloudIcon,
  },
  {
    name: "Batch Processing",
    description:
      "Process multiple photos at once with consistent AI enhancements, perfect for restoring entire photo albums or collections.",
    icon: CommandLineIcon,
  },
  {
    name: "One-Click Magic",
    description:
      "Get stunning results with simple one-click operations - no technical skills or photo editing experience required.",
    icon: RocketLaunchIcon,
  },
  {
    name: "Privacy First",
    description:
      "Your photos are processed securely and never stored on our servers. Complete privacy protection for your precious memories.",
    icon: UserGroupIcon,
  },
];

export function Features() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            AI-Powered Photo Magic
          </p>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Rediscover your memories with cutting-edge AI technology. Restore old photos,
              apply magical effects, and create stunning transformations with just a few clicks.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7">
                  <feature.icon
                    className="h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400"
                    aria-hidden="true"
                  />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
