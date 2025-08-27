import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is PhotoGag.AI really free to use?",
    answer: (
      <>
        Yes, PhotoGag.AI offers free AI photo editing features! Some advanced features may require credits, but basic photo restoration and enhancement tools are completely free to use.
      </>
    ),
  },
  {
    question: "What kind of photo editing features are available?",
    answer: (
      <>
        PhotoGag.AI includes a comprehensive set of AI-powered features:
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>AI Photo Restoration - repair old and damaged photos</li>
          <li>Age Transformation - see yourself at different ages</li>
          <li>Magic AI Effects - artistic filters and styles</li>
          <li>Smart Object Removal - remove unwanted elements</li>
          <li>Automatic Enhancements - lighting and color correction</li>
          <li>Background Replacement - change photo backgrounds</li>
          <li>Batch Processing - edit multiple photos at once</li>
          <li>One-Click Enhancements - instant improvements</li>
        </ul>
      </>
    ),
  },
  {
    question: "How does the AI technology work?",
    answer: (
      <>
        <p>PhotoGag.AI uses advanced machine learning algorithms:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Neural networks for image recognition and enhancement</li>
          <li>Generative AI for realistic age transformation</li>
          <li>Computer vision for object detection and removal</li>
          <li>Deep learning models for style transfer and effects</li>
          <li>Cloud-based processing for fast results</li>
        </ul>
      </>
    ),
  },
  {
    question: "How do I get started with photo editing?",
    answer: (
      <>
        <p>Getting started is easy! Just follow these simple steps:</p>
        <ol className="list-decimal pl-6 mt-2 space-y-1">
          <li>Create a free account</li>
          <li>Upload your photos to the platform</li>
          <li>Choose from our AI editing tools</li>
          <li>Apply enhancements with one click</li>
          <li>Download your transformed photos</li>
        </ol>
        <p className="mt-2">No technical skills or photo editing experience required!</p>
      </>
    ),
  },
  {
    question: "What types of photos work best?",
    answer: (
      <>
        <p>PhotoGag.AI works great with various photo types including:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Old family photos and historical images</li>
          <li>Portraits and selfies</li>
          <li>Landscape and nature photography</li>
          <li>Event photos (weddings, parties, etc.)</li>
          <li>Digital artwork and creative projects</li>
        </ul>
        <p>The AI handles both color and black &amp; white photos beautifully.</p>
      </>
    ),
  },
  {
    question: "What are the upcoming features?",
    answer: (
      <>
        <p>We&apos;re constantly improving PhotoGag.AI! Planned features include:</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Video enhancement and restoration</li>
          <li>Advanced AI filters and styles</li>
          <li>Mobile app for on-the-go editing</li>
          <li>Collaborative editing features</li>
          <li>Premium high-resolution exports</li>
          <li>Custom AI model training</li>
          <li>Integration with photo storage services</li>
        </ul>
      </>
    ),
  },
  {
    question: "How is my privacy protected?",
    answer: (
      <>
        Your privacy is our top priority. Photos are processed securely and automatically deleted after processing. We never store your images long-term or use them for training our AI models without your explicit permission. All data is encrypted and protected by industry-standard security measures.
      </>
    ),
  },
  {
    question: "Can I use PhotoGag.AI for commercial projects?",
    answer: (
      <>
        Yes! PhotoGag.AI can be used for both personal and commercial projects. Whether you&apos;re restoring family memories, enhancing professional photography, or creating content for business, our tools are designed to support your creative and commercial needs.
      </>
    ),
  },
  {
    question: "How can I provide feedback or suggestions?",
    answer: (
      <>
        We&apos;d love to hear about your experience with PhotoGag.AI! You can share your feedback,
        suggest new AI features, or report any issues directly through our in-app feedback form.
        Your ideas help us create even more magical photo transformations for everyone.
      </>
    ),
  },
];

export function FAQ() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl divide-y divide-gray-900/10 dark:divide-gray-100/10">
          <h2 className="text-2xl font-bold leading-10 tracking-tight">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="w-full mt-10">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose dark:prose-invert w-full max-w-none">
                    {faq.answer}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}